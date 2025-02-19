import React, { useState, useEffect, useCallback } from "react";
import { Table, Input, Button, Select, DatePicker, Spin } from "antd";
import axios from "axios";
import moment from "moment";

const { RangePicker } = DatePicker;
const { Option } = Select;


const App = () => {
    const [errorMessage, setErrorMessage] = useState("");
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState({
        searchText: "",
        accountNumbers: [],
        dateRange: [],
        txnEntryDateRange: [],
        valDateRange: [],
        dbamtRange: [],
        cramtRange: [],
        txnType: "",
        currency: "",
        minAmount: "",
        maxAmount: "",
        sortFields: [{ field: "TxnEntDte", order: "desc" }],
        sortOrder: "desc",
        total: 0,
    });

    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
    });

    // Fetch Transactions with Mandatory Fields & Filters
    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        if (!query.accountNumbers.length) {
            setErrorMessage("Mandatory Field Missing: AccNmbr is required.");
            setTransactions([]);
            setLoading(false);
            return;
        }

        if (!query.dateRange.length && !query.txnEntryDateRange.length && !query.valDateRange.length) {
            setErrorMessage("Conditional Mandatory Fields Missing: One of EntrDte, TxnEntDte, or ValDte is required.");
            setTransactions([]);
            setLoading(false);
            return;
        }

        let esQuery = {
            track_total_hits: true,
            query: {
                bool: {
                    must: [],
                    filter: [],
                },
            },
            sort: query.sortFields.map(sort => ({ [sort.field]: { order: sort.order } })),
            from: (pagination.page - 1) * pagination.pageSize,
            size: pagination.pageSize,
        };

        if (query.accountNumbers?.length) {
            esQuery.query.bool.filter.push({
                terms: { "AccNmbr": query.accountNumbers.map(String) },
            });
        }

        if (query.dateRange.length) {
            esQuery.query.bool.filter.push({
                range: { "EntrDte": { gte: query.dateRange[0], lte: query.dateRange[1] } },
            });
        } else if (query.txnEntryDateRange.length) {
            esQuery.query.bool.filter.push({
                range: { "TxnEntDte": { gte: query.txnEntryDateRange[0], lte: query.txnEntryDateRange[1] } },
            });
        } else if (query.valDateRange.length) {
            esQuery.query.bool.filter.push({
                range: { "ValDte": { gte: query.valDateRange[0], lte: query.valDateRange[1] } },
            });
        }

        if (query.searchText.length >= 3) {
            esQuery.query.bool.must.push({
                query_string: {
                    query: `${query.searchText}*`,
                    fields: ["AccNmbr", "CstmrRef", "TxnTyp", "Iban", "AccName"],
                    default_operator: "OR"
                }
            });
        }

        if (query.dbamtRange?.length === 2) {  
            esQuery.query.bool.filter.push({
                range: {
                    "DbAmt": {
                        gte: query.dbamtRange[0] || 0,  
                        lte: query.dbamtRange[1] || 1000000 
                    }
                },
            });
        }

        if (query.cramtRange?.length === 2) {
            esQuery.query.bool.filter.push({
                range: {
                    "CrAmt": {
                        gte: query.cramtRange[0] || 0,
                        lte: query.cramtRange[1] || 1000000
                    }
                },
            });
        }

        if (query.txnType) {
            esQuery.query.bool.must.push({ match: { "TxnTyp": query.txnType } });
        }
        if (query.currency) {
            esQuery.query.bool.must.push({ match: { "Ccy": query.currency } });
        }

        try {
            console.log("🔍 Sending API request:", esQuery);
            const response = await axios.post("http://localhost:5002/search", esQuery);
            console.log("Elasticsearch Response:", response.data);

            setTransactions(response.data.hits.hits.map(hit => hit._source));
            setQuery(prevQuery => ({
                ...prevQuery,
                total: response.data.hits.total.value,  // Ensure total hits are updated
            }));
        } catch (error) {
            setErrorMessage(`Error fetching transactions: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [query, pagination]);


    // Fetch Transactions
    useEffect(() => {
        fetchTransactions();
    }, [pagination]);

    return (
        <div style={{ padding: 20 }}>
            <h1>Barclays Transaction Search</h1>

            {/* Display Error Messages */}
            {errorMessage && (
                <div style={{ color: "red", fontWeight: "light", marginBottom: 10 }}>
                    {errorMessage}
                </div>
            )}

            {/* Filters */}
            <div style={{ marginBottom: 10 }}>
                <label>Account Numbers*:  </label>
                <Input
                    placeholder="Enter Account Numbers (comma-separated)"
                    onChange={(e) =>
                        setQuery({ ...query, accountNumbers: e.target.value.split(",").map(acc => acc.trim()) })
                    }
                    style={{ width: 300, marginRight: 10 }}
                />
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>Date Range*:  </label>
                <Select
                    defaultValue="EntrDte"
                    style={{ width: 200, marginRight: 10 }}
                    onChange={(value) => setQuery({ ...query, selectedDateField: value })}
                >
                    <Option value="EntrDte">Entry Date</Option>
                    <Option value="TxnEntDte">Transaction Entry Date</Option>
                    <Option value="ValDte">Value Date</Option>
                </Select>

                <RangePicker
                    onChange={(dates) => {
                        if (dates) {
                            const start = dates[0];
                            const end = dates[1];

                            // Check max 95 days
                            if (end.diff(start, "days") > 95) {
                                setErrorMessage(`Date range cannot exceed 95 days.`);
                                return;
                            }

                            // Check max 2 years back
                            if (start.isBefore(moment().subtract(2, "years"))) {
                                setErrorMessage(`You cannot select dates older than 2 years.`);
                                return;
                            }

                            setQuery({ ...query, dateRange: dates.map(d => d.format("YYYY-MM-DD")) });
                        } else {
                            setQuery({ ...query, dateRange: [] });
                        }
                    }}
                    style={{ marginRight: 20 }}
                />
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>Transaction Type: </label>
                <Select
                    placeholder="Select or type transaction type"
                    allowClear
                    showSearch
                    onChange={(value) => setQuery({ ...query, txnType: value || "" })}
                    style={{ width: 300, marginRight: 20 }}
                    dropdownRender={(menu) => (
                        <>
                            {menu}
                            <div style={{ display: 'flex', padding: '8px' }}>
                                <Input
                                    placeholder="Or type manually"
                                    onPressEnter={(e) => setQuery({ ...query, txnType: e.target.value })}
                                    style={{ flex: 'auto' }}
                                />
                            </div>
                        </>
                    )}
                >
                    <Option value="TRANSFER">TRANSFER</Option>
                    <Option value="WITHDRAWAL">WITHDRAWAL</Option>
                    <Option value="PAYMENT">PAYMENT</Option>
                    <Option value="DEPOSIT">DEPOSIT</Option>
                </Select>
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>Currency: </label>
                <Select
                    placeholder="Select or type currency"
                    allowClear
                    showSearch
                    onChange={(value) => setQuery({ ...query, currency: value || "" })}
                    style={{ width: 300, marginRight: 20 }}
                    dropdownRender={(menu) => (
                        <>
                            {menu}
                            <div style={{ display: 'flex', padding: '8px' }}>
                                <Input
                                    placeholder="Or type manually"
                                    onPressEnter={(e) => setQuery({ ...query, currency: e.target.value })}
                                    style={{ flex: 'auto' }}
                                />
                            </div>
                        </>
                    )}
                >
                    <Option value="GBP">GBP</Option>
                    <Option value="EUR">EUR</Option>
                    <Option value="JPY">JPY</Option>
                </Select>
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>Debit Amount: </label>
                <Input
                    placeholder="Min Amount"
                    type="number"
                    style={{ width: 120, marginLeft: 0 }}
                    onChange={(e) => setQuery(prev => ({
                        ...prev,
                        dbamtRange: [e.target.value, prev.dbamtRange?.[1] || ""]
                    }))}
                />

                <Input
                    placeholder="Max Amount"
                    type="number"
                    style={{ width: 120, marginLeft: 10 }}
                    onChange={(e) => setQuery(prev => ({
                        ...prev,
                        dbamtRange: [prev.dbamtRange?.[0] || "", e.target.value]
                    }))}
                />
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>Credit Amount: </label>
                <Input
                    placeholder="Min Amount"
                    type="number"
                    style={{ width: 120, marginLeft: 0 }}
                    onChange={(e) => setQuery(prev => ({
                        ...prev,
                        cramtRange: [e.target.value, prev.cramtRange?.[1] || ""]
                    }))}
                />

                <Input
                    placeholder="Max Amount"
                    type="number"
                    style={{ width: 120, marginLeft: 10 }}
                    onChange={(e) => setQuery(prev => ({
                        ...prev,
                        cramtRange: [prev.cramtRange?.[0] || "", e.target.value]
                    }))}
                />
            </div>

            {/* Sorting */}
            <div style={{ marginBottom: 10 }}>
                <label>Primary Sort By:</label>
                <Select
                    defaultValue="TxnEntDte"
                    onChange={(value) => {
                        setQuery(prev => ({
                            ...prev,
                            sortFields: [
                                { field: value, order: prev.sortFields?.[0]?.order || "desc" },
                                ...prev.sortFields.slice(1)
                            ]
                        }));
                    }}
                    style={{ marginLeft: 10 }}
                >
                    <Option value="TxnEntDte">Transaction Entry Date</Option>
                    <Option value="AccNmbr">Credit Amount</Option>
                    <Option value="EntrDte">Entry Date</Option>
                    <Option value="ValDte">Value Date</Option>
                    <Option value="Ccy">Currency</Option>
                    <Option value="Iban">Iban</Option>
                    <Option value="CrAmt">Credit Amount</Option>
                    <Option value="DbAmt">Debit Amount</Option>


                </Select>

                <Select
                    defaultValue="desc"
                    onChange={(value) => {
                        setQuery(prev => ({
                            ...prev,
                            sortFields: [
                                { field: prev.sortFields?.[0]?.field || "TxnEntDte", order: value },
                                ...prev.sortFields.slice(1)
                            ]
                        }));
                    }}
                    style={{ marginLeft: 10 }}
                >
                    <Option value="asc">Ascending</Option>
                    <Option value="desc">Descending</Option>
                </Select>
            </div>
            <div style={{ marginBottom: 10 }}>

                <label>Secondary Sort By:</label>
                <Select
                    defaultValue="CrAmt"
                    onChange={(value) => {
                        setQuery(prev => ({
                            ...prev,
                            sortFields: [
                                prev.sortFields[0],
                                { field: value, order: prev.sortFields?.[1]?.order || "desc" }
                            ]
                        }));
                    }}
                    style={{ marginLeft: 10 }}
                >
                    <Option value="TxnEntDte">Transaction Entry Date</Option>
                    <Option value="AccNmbr">Credit Amount</Option>
                    <Option value="EntrDte">Entry Date</Option>
                    <Option value="ValDte">Value Date</Option>
                    <Option value="Ccy">Currency</Option>
                    <Option value="Iban">Iban</Option>
                    <Option value="CrAmt">Credit Amount</Option>
                    <Option value="DbAmt">Debit Amount</Option>
                </Select>

                <Select
                    defaultValue="desc"
                    onChange={(value) => {
                        setQuery(prev => ({
                            ...prev,
                            sortFields: [
                                prev.sortFields[0],
                                { field: prev.sortFields?.[1]?.field || "CrAmt", order: value }
                            ]
                        }));
                    }}
                    style={{ marginLeft: 10 }}
                >
                    <Option value="asc">Ascending</Option>
                    <Option value="desc">Descending</Option>
                </Select>
            </div>

            {/* Primary Search */}
            <Button
                type="primary"
                onClick={fetchTransactions} 
                style={{ marginLeft: 0, marginBottom: 20 }}
            >
                Search
            </Button>

            {/* Table display */}
            {loading ? (
                <Spin size="large" style={{ display: "block", margin: "20px auto" }} />
            ) : (
                <Table
                    dataSource={transactions}
                    columns={[
                        {
                            title: "Account Number",
                            dataIndex: "AccNmbr",
                            key: "AccNmbr",
                        },
                        {
                            title: "Customer Reference",
                            dataIndex: "CstmrRef",
                            key: "CstmrRef",
                        },
                        {
                            title: "Transaction Type",
                            dataIndex: "TxnTyp",
                            key: "TxnTyp",
                        },
                        {
                            title: "Credit Amount",
                            dataIndex: "CrAmt",
                            key: "CrAmt",
                        },
                        {
                            title: "Currency",
                            dataIndex: "Ccy",
                            key: "Ccy",
                        },
                        ,
                        {
                            title: "Debit Amount",
                            dataIndex: "DbAmt",
                            key: "DbAmt",
                        },
                        ,
                        {
                            title: "Account Name",
                            dataIndex: "AccName",
                            key: "AccName",
                        },
                        ,
                        {
                            title: "Iban",
                            dataIndex: "Iban",
                            key: "Iban",
                        },
                        {
                            title: "Transaction Entry Date",
                            dataIndex: "TxnEntDte",
                            key: "TxnEntDte",
                        },
                        {
                            title: "Entry Date",
                            dataIndex: "EntrDte",
                            key: "EntrDte",
                        },
                        {
                            title: "Validation Date",
                            dataIndex: "ValDte",
                            key: "ValDte",
                        },

                    ]}
                    expandable={{
                        expandedRowRender: (record) => (
                            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {JSON.stringify(record, null, 2)}
                            </pre>
                        ),
                        rowExpandable: (record) => !!record,
                    }}
                    pagination={{
                        current: pagination.page,
                        pageSize: pagination.pageSize,
                        total: query.total,
                        showSizeChanger: true,
                        onChange: (page, pageSize) => {
                            console.log(`Changing Page: ${page}, Page Size: ${pageSize}`);
                            setPagination({
                                page,
                                pageSize,
                            });
                        },
                    }}
                />
            )}
        </div>
    );
};

export default App;
