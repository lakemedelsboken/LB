var scrypt = require("scrypt");

scrypt.verify.config.keyEncoding = "utf8";
scrypt.verify.config.hashEncoding = "base64";

var hash = "c2NyeXB0ABEAAAAIAAAAAcX3xLyekVkBe2SVlFRca+HHb6h886O4fC8mols/DwfC7L+S1ruiYTL5eY+gaPxx/Sim3F70co0HF/nsnK1dxey0oOrx26PFRjMYxnAPOgav";

console.log(scrypt.verify(hash, "password")); //result will be true
console.log(scrypt.verify(hash, "incorrect password")); //result will be false
