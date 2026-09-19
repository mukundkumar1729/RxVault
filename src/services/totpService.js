// ════════════════════════════════════════════════════════════
//  TOTPSERVICE.JS — RFC 6238 Time-Based One-Time Password Engine
//  Native Web Crypto API (HMAC-SHA1) with Base32 Encoding/Decoding
//  Zero backend dependency, compatible with Google/MS Authenticator
// ════════════════════════════════════════════════════════════

var TotpService = (function () {
  var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(buffer) {
    var bytes = new Uint8Array(buffer);
    var bits = 0;
    var value = 0;
    var output = '';

    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  function base32Decode(input) {
    if (!input) return new Uint8Array(0);
    var clean = input.toUpperCase().replace(/[\s\-_=]/g, '');
    var bits = 0;
    var value = 0;
    var bytes = [];

    for (var i = 0; i < clean.length; i++) {
      var val = BASE32_ALPHABET.indexOf(clean[i]);
      if (val === -1) {
        throw new Error('Invalid Base32 character: ' + clean[i]);
      }
      value = (value << 5) | val;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(bytes);
  }

  // Generates 20 random bytes (160 bits) encoded in Base32
  function generateSecret(byteLength) {
    byteLength = byteLength || 20;
    var array = new Uint8Array(byteLength);
    window.crypto.getRandomValues(array);
    return base32Encode(array);
  }

  // Formats secret in groups of 4 for human readability (e.g., ABCD EFGH ...)
  function formatSecret(secret) {
    if (!secret) return '';
    var clean = secret.toUpperCase().replace(/[\s\-_]/g, '');
    var chunks = [];
    for (var i = 0; i < clean.length; i += 4) {
      chunks.push(clean.substring(i, i + 4));
    }
    return chunks.join(' ');
  }

  // Generates standard otpauth:// URI for authenticator apps
  function getOtpAuthUri(email, secret, issuer) {
    issuer = (issuer || 'RxVault').trim();
    email = (email || 'user').trim();
    var cleanSecret = (secret || '').toUpperCase().replace(/[\s\-_]/g, '');

    var encodedIssuer = encodeURIComponent(issuer);
    var encodedEmail = encodeURIComponent(email);

    return (
      'otpauth://totp/' +
      encodedIssuer +
      ':' +
      encodedEmail +
      '?secret=' +
      cleanSecret +
      '&issuer=' +
      encodedIssuer +
      '&digits=6&period=30'
    );
  }

  // Generates 6-digit TOTP code for a specific 30-second time step
  async function generateTotpForStep(keyBytes, step) {
    // 8-byte big-endian counter
    var buffer = new ArrayBuffer(8);
    var view = new DataView(buffer);
    view.setUint32(0, Math.floor(step / 0x100000000), false);
    view.setUint32(4, step >>> 0, false);

    var cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    var signature = await window.crypto.subtle.sign('HMAC', cryptoKey, buffer);
    var hash = new Uint8Array(signature);

    var offset = hash[hash.length - 1] & 0x0f;
    var binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    var otp = binary % 1000000;
    return String(otp).padStart(6, '0');
  }

  // Validates a 6-digit TOTP code against the secret (with +/- 1 step tolerance)
  async function verifyTotp(secret, code, toleranceSteps) {
    if (!secret || !code) return false;
    toleranceSteps = toleranceSteps !== undefined ? toleranceSteps : 1;

    var cleanCode = String(code).trim().replace(/[\s\-]/g, '');
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) return false;

    try {
      var keyBytes = base32Decode(secret);
      var currentStep = Math.floor(Date.now() / 1000 / 30);

      for (var s = -toleranceSteps; s <= toleranceSteps; s++) {
        var generated = await generateTotpForStep(keyBytes, currentStep + s);
        if (generated === cleanCode) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('TOTP verification error:', err);
      return false;
    }
  }

  // Generates QR Code data URL using QRCode library (fallback if not loaded)
  async function generateQrCodeDataUrl(uri) {
    return new Promise(function (resolve) {
      if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
        QRCode.toDataURL(
          uri,
          { width: 180, margin: 2, errorCorrectionLevel: 'Q' },
          function (err, url) {
            if (err) {
              console.error('QR code generation failed:', err);
              resolve('');
            } else {
              resolve(url);
            }
          }
        );
      } else {
        console.warn('QRCode library is not loaded');
        resolve('');
      }
    });
  }

  return {
    generateSecret: generateSecret,
    formatSecret: formatSecret,
    getOtpAuthUri: getOtpAuthUri,
    verifyTotp: verifyTotp,
    generateQrCodeDataUrl: generateQrCodeDataUrl,
    base32Decode: base32Decode,
    base32Encode: base32Encode
  };
})();
