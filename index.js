const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();
const port = 3000;
const BASE_URL = `http://localhost:${port}`;
const PROXY_BASEURL = 'http://localhost:8008';

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

function logRequestResponse(req, proxyResponse, err) {
    const fileName = `${req.method}-${req.originalUrl}`.replace(/\//g, "|");
    fs.writeFileSync(`${__dirname}/requests/${fileName}.json`, JSON.stringify({
        request: {
            headers: req.headers,
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

async function proxyRequest(method, req) {
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
        response = err.response;
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
