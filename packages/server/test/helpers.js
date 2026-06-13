const http = require('node:http');
const Module = require('node:module');

function loadFresh(modulePath, mocks = {}, purge = []) {
  for (const target of [modulePath, ...purge]) {
    delete require.cache[require.resolve(target)];
  }

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function request(server, { method = 'GET', path = '/', headers = {}, body } = {}) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        host: '127.0.0.1',
        port: address.port,
        path,
        headers,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      },
    );

    req.on('error', reject);

    if (body !== undefined) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  loadFresh,
  request,
};
