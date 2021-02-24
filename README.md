# api-logger
Proxies requests to another API and logs the request and responses


## Setup

Install npm dependencies
`npm install`

## Running
Modify the `const PROXY_BASEURL = 'http://localhost:8000';` in index.js and replace it with the API you want to proxy requests to and log responses from

Run `node index.js` to start the service the logger on `http://localhost:3000`

Point you're clients at `http://localhost:3000` rather than the original endpoint and all unique requests (Based on method and URL) will be logged to the `./requests` directory