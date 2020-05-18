let forge = require("node-forge");
let pki = forge.pki;
let iCrypto = require("../../chat/server/classes/libs/iCrypto");

let print = console.log;
// let ic = new iCrypto();
// ic.generateRSAKeyPair("kp");
//
// let pub = ic.get("kp").publicKey;
// let priv =  ic.get("kp").privateKey;


let pub = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqamoo07uXyMLvN/sdiQi
GSYXqFHaDdu3mM/IrWRKXVl48he943/cZEd4iKlRa/kejoo4ZZTpvq5Ncoy4+l1T
WEIeHifm4jNS9Eg9g9uAo7pqOH+isQQxN0l2gS9xiCSTPz99gP+iZI00m+wdSaOM
IoGyCJ301F/fZGpofegoG518XXaFQUCRWYnqP79iQ3sic+jm9pgU8qfcNJf0bRri
fsBMzBedMovPrfR2j5A4CTGwyUSgjhrY5tC5w6oHxA6aX5Rfv5jd0S2ILLPhNKKk
IwbW3DFBDGis378XzPkr3zaB8KrE7P1V9CXOvzH1DhjZX71ZEJ1Xl4KrVpyygZqC
lQIDAQAB
-----END PUBLIC KEY-----
`

let priv = `-----BEGIN RSA PRIVATE KEY-----
MIIEoAIBAAKCAQEAqamoo07uXyMLvN/sdiQiGSYXqFHaDdu3mM/IrWRKXVl48he9
43/cZEd4iKlRa/kejoo4ZZTpvq5Ncoy4+l1TWEIeHifm4jNS9Eg9g9uAo7pqOH+i
sQQxN0l2gS9xiCSTPz99gP+iZI00m+wdSaOMIoGyCJ301F/fZGpofegoG518XXaF
QUCRWYnqP79iQ3sic+jm9pgU8qfcNJf0bRrifsBMzBedMovPrfR2j5A4CTGwyUSg
jhrY5tC5w6oHxA6aX5Rfv5jd0S2ILLPhNKKkIwbW3DFBDGis378XzPkr3zaB8KrE
7P1V9CXOvzH1DhjZX71ZEJ1Xl4KrVpyygZqClQIDAQABAoIBABkrG+MuAFqInmMk
bLWR4qUMa5IConBP2cqHeGOQbx+t+C0hrH+lJhKSL6VGSNfVmtzWUEtxbcNlpAOM
MJyjX4vGMyWSEcQYjQPD+6wl0c14B+3dsUrFLm/fK/86BIOHuXg2eO27/mEgOV+w
BSA5bL5psvloRTuEBWWmC14yJFEEKymB81aokeECfAYBdTcXUmWbtOUGo1PBewPi
LEyoV3rSl0HS8uLSlOMxDeSNWlwvXPLv8DnNSedW5CsxUV8vUMrDMCSsaXBEv7b8
hFQxpaDPHTLbifb7fkyKodPwYaQLWlCOG6Z6DVI9HOzsxD2kiBkDrHlnqsob9W0y
vawQ4LkCgYEA87LZOipAuL5S46aANr14gszs7auYaavSqMuZi/qa/rwwPE9/fnRb
ERMVNzj127U9HtA/z8YUeG21fCoJ66MVd7fbbN71mc0n54Keil8SUqHv4HCKjJYj
iNjvlrYSHx6prhNj30dQeBbe2Xsdmhd+2oWliPH+sayJAFpdOfRcx2cCgYEAsjoY
PdrpgJ2gv30+Phl0miaWKTKuIsLV3XqoWaB1Wm8kGdmX8YKxrH6Xzm/ZUqZhw/7k
0V4T3dmDbE+X4SG+u0YH+UDknmwHUDNfWajMyAn/KIE5WkmSk2kBKB/0ivoIeS3k
/TmrSsQXopUVvx6bG7lKEWUHIOTzrSqxdzbAlKMCgYB1SO0c/jrZ7tdLstVgAv4d
zWx10jDvIn+nNx217a1szbtVO1l7zZoKdKmwQxyoWeiJjOY5I/a0IvDGSiEuI/Xw
AS98jS2ckM0UsZuFss3JsSAWX3N+x79gXC+q1AOSsJovKivVyKektDUabBNKFua5
WrrZVsYiUow4/ESD4ORKHwKBgCcUOfCGKaD77x1NtvIi3sBWKaLK7AfPNNmlZXiR
iGnV6NKKNZjNEWxDLcIkIEDRHqq9HysRN8XzRa/gG+tPXOTvTBxJMFfUVB4vxX6B
VrWeC4a0HwE/FJah9ZD4wMQgYu8/MvCbToXMTWpmyifn7Ba+IBGEV3XM/elAbT04
ki2FAn8Z3Lr6irtUTfNMYocxDIWnTQO8EOauXUgR6m1kRseF3cz9nuRfww8kbOq2
LpbwEMYpJgPjbDypB4GWJq5fCBL9IsI6FdV7FPnKewvJaUIfPwY16Izw+FEZTROZ
JWc5sx+x1vjzR59hFWdxWVza64mZPeKNoVC/VoqXKXffBS12
-----END RSA PRIVATE KEY-----
`

let data = "this is the string I am going to encrypt";

let ic = new iCrypto();
ic.setRSAKey("pub", pub, "public");
ic.setRSAKey("priv", priv, "private");
ic.addBlob("data", data)
    .publicKeyEncrypt("data", "pub", "cip")
    .privateKeyDecrypt("cip", "priv", "dec");

//console.log(ic.get("dec"));


let privateKeyInfo = pki.wrapRsaPrivateKey(pki.privateKeyToAsn1(pki.privateKeyFromPem(priv)));

var encryptedPrivateKeyInfo = forge.pki.encryptPrivateKeyInfo(
    privateKeyInfo, '123', {
        algorithm: 'aes256', // 'aes128', 'aes192', 'aes256', '3des'
    });

//print(encryptedPrivateKeyInfo);

//var salt = forge.random.getBytesSync(128);
let salt = forge.random.getBytesSync(128);
var key = forge.pkcs5.pbkdf2('bldabla124', salt, 20000, 64);
let b64enc = iCrypto.base64Encode(key);
let s64 = iCrypto.base64Encode(salt);
//ic.setSYMKey("sym", )
print(s64.length);
print(salt.length);
