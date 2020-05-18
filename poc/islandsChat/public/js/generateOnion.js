/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*
 * thirty-two
 * https://github.com/chrisumbel/thirty-two
 *
 * Copyright (c) 2011, Chris Umbel
 */
function base32(plain) {
    var charTable = "abcdefghijklmnopqrstuvwxyz234567";
    plain = new Uint8Array(plain);

    var shiftIndex = 0;
    var digit = 0;
    var encoded = "";

    for (var i=0; i<plain.length;) {
        var current = plain[i];

        if (shiftIndex > 3) {
            digit = current & (0xff >> shiftIndex);
            shiftIndex = (shiftIndex + 5) % 8;
            digit = (digit << shiftIndex) | ((i + 1 < plain.length) ?
                plain[i + 1] : 0) >> (8 - shiftIndex);
            i++;
        } else {
            digit = (current >> (8 - (shiftIndex + 5))) & 0x1f;
            shiftIndex = (shiftIndex + 5) % 8;
            if (shiftIndex == 0) i++;
        }

        encoded += charTable[digit];
    }

    return encoded;
}

/*
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
function base64(arraybuffer) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bytes = new Uint8Array(arraybuffer),
        i, len = bytes.length, base64 = "";

    for (i = 0; i < len; i+=3) {
        base64 += chars[bytes[i] >> 2];
        base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
        base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
        base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
        base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
        base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
}

function formatKey(key) {
    // Export the DER-encoded ASN.1 private key information.
    var promise = crypto.subtle.exportKey("pkcs8", key);

    return promise.then(function (pkcs8) {
        var encoded = base64(pkcs8);

        // Wrap lines after 64 characters.
        var formatted = encoded.match(/.{1,64}/g).join("\n");

        // Wrap the formatted key in a header and footer.
        return "-----BEGIN PRIVATE KEY-----\n" + formatted +
            "\n-----END PRIVATE KEY-----";
    });
}

function generateRSAKey() {
    var alg = {
        // This could be any supported RSA* algorithm.
        name: "RSASSA-PKCS1-v1_5",
        // We won't actually use the hash function.
        hash: {name: "SHA-1"},
        // Tor hidden services use 1024 bit keys.
        modulusLength: 1024,
        // We will use a fixed public exponent for now.
        publicExponent: new Uint8Array([0x03])
    };

    return crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
}

function computeOnionHash(publicKey) {
    // Export the DER encoding of the SubjectPublicKeyInfo structure.
    var promise = crypto.subtle.exportKey("spki", publicKey);

    promise = promise.then(function (spki) {
        // Compute the SHA-1 digest of the SPKI.
        // Skip 22 bytes (the SPKI header) that are ignored by Tor.
        return crypto.subtle.digest({name: "SHA-1"}, spki.slice(22));
    });

    return promise.then(function (digest) {
        // Base32-encode the first half of the digest.
        return base32(digest.slice(0, 10));
    });
}

function findOnionName(pattern) {
    var key;

    // Start by generating a random key pair.
    var promise = generateRSAKey().then(function (pair) {
        key = pair.privateKey;

        // Generate the .onion hash of the public key.
        return computeOnionHash(pair.publicKey);
    });

    return promise.then(function (hash) {
        // Try again if the pattern doesn't match.
        if (!pattern.test(hash)) {
            return findOnionName(pattern);
        }

        // Key matches! Export and format it.
        return formatKey(key).then(function (formatted) {
            return {key: formatted, hash: hash};
        });
    });
}

// findOnionName(/ab/).then(function (result) {
//     console.log(result.hash + ".onion", result.key);
// }, function (err) {
//     console.log("An error occurred, please reload the page.");
// });