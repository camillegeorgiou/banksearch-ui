from elasticsearch import Elasticsearch
from datetime import datetime, time, timedelta
import random
import json
from faker import Faker
from tqdm import tqdm

# Elastic Cloud API conf (for onprem, use alt auth)
CLOUD_ID = "CLOUD ID"
API_KEY = "API KEY"

es = Elasticsearch(
    cloud_id=CLOUD_ID,
    api_key=API_KEY,
    request_timeout=30  
)

fake = Faker()

account_numbers = [str(random.randint(100000000000, 999999999999)) for _ in range(50)]
currencies = ["USD", "EUR", "GBP", "JPY"]
txn_types = ["TRANSFER", "WITHDRAWAL", "DEPOSIT"]
bank_refs = ["BankRef001", "BankRef002", "BankRef003"]
customer_refs = [f"CustRef{random.randint(10000,99999)}" for _ in range(10)]
iban_values = ["IBAN123", "IBAN456", "IBAN789"]

# Generate a random transaction
def generate_transaction():
    txn_date = datetime.utcnow() - timedelta(days=random.randint(1, 95))
    return {
        "AccNmbr": random.choice(account_numbers),
        "AccName": fake.company(),
        "AccEntrStsFlg": random.choice(["Active", "Inactive"]),
        "AccTyp": random.choice(["Business", "Personal"]),
        "Amt": round(random.uniform(100, 10000), 2),
        "BnkIdfr": fake.bban(),
        "BnkRef": random.choice(bank_refs),
        "Ccy": random.choice(currencies),
        "ChqNo": f"CHQ{random.randint(1000,9999)}",
        "ChqPmtInfId": fake.uuid4(),
        "ClrdFteDt": txn_date.isoformat(),
        "ClrdOfIntrstDte": txn_date.isoformat(),
        "ClrdStats": random.choice(["Cleared", "Pending"]),
        "CntrPrtyAccNo": fake.iban(),
        "CntrPrtyBnkSrtCde": fake.swift(),
        "CntrPrtyNme": fake.company(),
        "CrAmt": round(random.uniform(100, 10000), 2),
        "CstmrRef": random.choice(customer_refs),
        "DbAmt": round(random.uniform(100, 10000), 2),
        "DbCreInd": random.choice(["CR", "DB"]),
        "EntCrtdDtTm": txn_date.isoformat(),
        "EntrDte": txn_date.isoformat(),
        "Iban": random.choice(iban_values),
        "InpDt": txn_date.isoformat(),
        "InpTm": fake.time(),
        "Narrative1": fake.sentence(),
        "Narrative2": fake.sentence(),
        "NartvLn1": fake.sentence(),
        "NartvLn2": fake.sentence(),
        "NartvLn3": fake.sentence(),
        "NartvLn4": fake.sentence(),
        "NmbrOfTxn": random.randint(1, 500),
        "OfsAccHTag": fake.word(),
        "PrtryTp": fake.word(),
        "Rsn": fake.sentence(),
        "SrcIdr": "BCBS",
        "SrcSysTrnRef": fake.uuid4(),
        "TransCdeDsc": fake.word(),
        "TrnCd9": fake.word(),
        "TxnDtls": fake.sentence(),
        "TxnEntDte": txn_date.isoformat(),
        "TxnTyp": random.choice(txn_types),
        "ValDte": txn_date.isoformat()
    }

# No of transactions to generate
NUM_RECORDS = 10000
BATCH_SIZE = 500 

# Index data in batches
def bulk_index_data(data_batch):
    bulk_data = []
    for doc in data_batch:
        bulk_data.append(json.dumps({"index": {"_index": "transaction_index"}}))
        bulk_data.append(json.dumps(doc))

    # Send bulk request with retry logic
    try:
        response = es.bulk(body="\n".join(bulk_data))
        if response.get("errors"):
            print("Records failed to index:", response)
        else:
            print(f"Indexed {len(data_batch)} records successfully!")
    except Exception as e:
        print(f"Indexing failed: {e}")
        time.sleep(5)  # Wait before retrying
        bulk_index_data(data_batch)  # Retry indexing

# Generate & index data in batches
all_data = []
for _ in tqdm(range(NUM_RECORDS), desc="Generating Data"):
    all_data.append(generate_transaction())

    if len(all_data) >= BATCH_SIZE:
        bulk_index_data(all_data)
        all_data = []

# Index remaining records
if all_data:
    bulk_index_data(all_data)

print("Successfully indexed")