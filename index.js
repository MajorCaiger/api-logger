const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();
const service = "";
const port = 3000;
const BASE_URL = `http://localhost:${port}`;
const PROXY_BASEURL = 'http://localhost:8888';

const args = process.argv.slice(2);
let writeWiremocks = false;
if (args.indexOf("-wm") !== -1) {
    console.log("writing wiremocks")
    writeWiremocks = true;
}

function rawBody(req, res, next) {
    req.setEncoding('utf8');
    req.rawBody = '';
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    req.on('end', function(){
        next();
    });
}

app.use(rawBody);

function formatBody(body) {
    if (body === null) {
        return null;
    }

    try {
        const objectBody = JSON.parse(body);

        return JSON.stringify(objectBody, null, 2);
    } catch (err) {
        return body;
    }
}

function writeWiremocksToFile(mappingFileName, req, proxyResponse) {
    const bodyFileName = `${mappingFileName}__Body`;
    fs.writeFileSync(`${__dirname}/requests/${mappingFileName}.json`, JSON.stringify({
        request: {
            method: req.method,
            url: `${service}${req.originalUrl}`
        },
        response: {
            headers: req.headers,
            status: proxyResponse.status,
            bodyFileName: `${bodyFileName}.json`
        }
    }, null, 2));
    fs.writeFileSync(`${__dirname}/requests/${bodyFileName}.json`, JSON.stringify(formatBody(proxyResponse.data), null, 2));
}

function dumpToFile(fileName, req, proxyResponse, err) {
    fs.writeFileSync(`${__dirname}/requests/${fileName}.json`, JSON.stringify({
        request: {
            headers: req.headers,
            cookies: req.cookies,
            method: req.method,
            path: req.originalUrl,
            body: formatBody(req.rawBody)
        },
        response: proxyResponse ? {
            headers: proxyResponse.headers,
            status: proxyResponse.status,
            body: formatBody(proxyResponse.data)
        } : { error: err.message }
    }, null, 2));
}

function logRequestResponse(req, proxyResponse, err) {
    const mappingFileName = `${req.method}${service}${req.originalUrl}`
        .replace(/\//g, "_")
        .replace(/\?/g, "-")
        .replace("=", "|");

    if (writeWiremocks && !err) {
        writeWiremocksToFile(mappingFileName, req, proxyResponse);
    } else {
        dumpToFile(mappingFileName, req, proxyResponse, err)
    }
}

async function proxyRequest(method, req) {
    console.log("url = " +`${PROXY_BASEURL}${req.originalUrl}`)
    switch (method) {
        case 'get':
            return axios.get(`${PROXY_BASEURL}${req.originalUrl}`, {headers: req.headers});
        case 'delete':
            return axios.delete(`${PROXY_BASEURL}${req.originalUrl}`, {headers: req.headers});
        case 'put':
            return axios.put(`${PROXY_BASEURL}${req.originalUrl}`, req.rawBody, {headers: req.headers});
        case 'post':
            return axios.post(`${PROXY_BASEURL}${req.originalUrl}`, req.rawBody, {headers: req.headers});
    }
}

const handler = method => async (req, res) => {
    let response;
    let error;
    try {
        response = await proxyRequest(method, req);
    } catch (err) {
        error = err;
        response = err.response ? err.response : err.error;
    }
    logRequestResponse(req, response, error);
    Object.keys(response.headers).forEach(name => {
        res.append(name, response.headers[name]);
    })
    res.status(response.status)
        .send(response.data);
}

app.post('*', handler('post'));
app.get('*', handler('get'));
app.put('*', handler('put'));
app.delete('*', handler('delete'));

app.listen(port, () => {
    console.log(`Example app listening at ${BASE_URL}`);
});
