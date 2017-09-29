var scrypt = require("scrypt");
var scryptParameters = scrypt.params(0.5);
var key = "addyourkey";

scrypt.hash.config.keyEncoding = "utf8";
scrypt.hash.config.outputEncoding = "base64";

var hash = scrypt.hash(key, scryptParameters);

console.log(typeof hash);
console.log(hash);