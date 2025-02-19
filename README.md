# banksearch-ui

Basic bank transaction search app using Elastic, React and Node.js as a proxy.

**Steps:**

1. Generate synthetic data and post to Elastic

- modify python_gen.py to include:

CLOUD_ID = "CLOUD ID"
API_KEY = "API KEY"

Run `python python_gen.py`


2. Establish project

- npx create-react-app elasticsearch-ui
- cd elasticsearch-ui
- npm install axios antd moment

Copy the App.js code to the relevant directory in your new project.

3. Run the proxy and app

Run `node server.js`
Run `npm run start`
