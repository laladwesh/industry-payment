const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  app.use(
    "/ccd-industry/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      secure: false,
      pathRewrite: (path) => `/ccd-industry/api${path}`,
    })
  );
};
