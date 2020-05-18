from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend, interfaces
from cryptography.exceptions import InvalidSignature
from base64 import *
import logging

log = logging.getLogger(__name__)

class ICrypto:
    def __init__(self):
        self.locked = False
        self._storage = {}
        self._encodings = {
            "hex": b16encode,
            "base64": b64decode
        }

        self._decodings = {
            "hex": b16decode,
            "base64": b64decode
        }


    def __getitem__(self, key):
        if key not in self._storage:
            raise KeyError("ICrypto error: Item not found")
        res = self._storage[key]
        if isinstance(res, rsa.RSAPrivateKey):
            return self._to_pem(res, True)
        elif isinstance(res, rsa.RSAPublicKey):
            return self._to_pem(res, False)

        return res

    def __setitem__(self, key, value):
        if self.locked:
            raise ICryptoObjectLockedException
        self._storage[key] = value



    def create_nonce(self, name_to_save, length):
        pass

    def create_rsa_keypair(self, name_to_save, length=2048):
        self[name_to_save] = rsa.generate_private_key(
            public_exponent=65537,
            key_size=length,
            backend=default_backend())
        return self

    def encrypt_private_key(self, name_to_save, key, password):
        """
        Encrypts and serializes raw private key and saves it under "name_to_save"
        inside this ICrypto object
        :param name_to_save: string - key to save result
        :param key: key to find private key
        :param password: password to encrypt private key with as bytes
        :return: self
        """
        if not password:
            raise AttributeError("Password required")
        private_key = self._get_raw_rsa_key(key)
        self[name_to_save] =  private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(password)
        )
        return self


    def public_key_encrypt(self, name_to_save, target, key):
        pass

    def private_key_decrypt(self, name_to_save, target, key):
        pass

    def add_blob(self, name_to_save, blob):
        self[name_to_save] = blob
        return self

    def public_from_private(self, name_to_save, target):
        self[name_to_save] = self._get_raw_rsa_key(target).public_key()
        return self

    def private_key_sign(self, name_to_save, target, key, encoding="hex"):
        private_key = self._get_raw_rsa_key(key)
        message = self[target]
        res = private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
            )
        self[name_to_save] = self._encodings[encoding](res) if encoding else res
        return self

    def public_key_verify(self, name_to_save, target, key, signature, sign_dehex = True):
        public_key = self._get_raw_rsa_key(key)
        blob = self[target]
        sign = b16decode(self[signature]) if sign_dehex else self[signature]
        try:
            public_key.verify(
                sign,
                blob,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
        except InvalidSignature:
            self[name_to_save] = False
            return self
        self[name_to_save] = True
        return self

    def load_pem_private_key(self, name_to_save, pem_data, password=None):
        """
        Given  private key pem data decrypts and loads it.
        :param name_to_save:
        :param pem_data: key data
        :param password: utf8 string or None
        :return:
        """
        res = serialization.load_pem_private_key(
            data=pem_data,
            password=bytes(password, "utf8"),
            backend=default_backend()
        )
        self[name_to_save] = res
        return self

    def load_pem_public_key(self, name_to_save, pem_data):
        self[name_to_save] = serialization.load_pem_public_key(
            data=pem_data,
            backend=default_backend()
        )
        return self

    def hash_file(self, name_to_save, filepath):
        digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
        with open(filepath, "rb") as file_obj:
            for chunk in ICrypto.read_file_in_chunks(file_obj):
                digest.update(chunk)
        self[name_to_save] = b16encode(digest.finalize())
        return self

    @staticmethod
    def read_file_in_chunks(file_obj, chunk_size=262144):
        while True:
            data = file_obj.read(chunk_size)
            if not data:
                break
            yield data

    def get_public_key_fingerprint(self, name_to_save, key):
        rsa_key = self._get_raw_rsa_key(key)
        if isinstance(rsa_key, rsa.RSAPrivateKey):
            rsa_key = rsa_key.public_key()
        raw = rsa_key.public_bytes(
            format=serialization.PublicFormat.PKCS1,
            encoding=serialization.Encoding.DER
        )
        digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
        digest.update(raw)
        self[name_to_save] = b16encode(digest.finalize())
        return self

    def _to_pem(self, key, private=False, password=None):
        return key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption() if password is None else
            serialization.BestAvailableEncryption(password)
        ) if private else key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

    def _get_raw_rsa_key(self, key):
        if key not in self._storage:
            raise KeyError("ICrypto error: Item not found")
        res = self._storage[key]
        if not isinstance(res, rsa.RSAPrivateKey) and not isinstance(res, rsa.RSAPublicKey):
            raise TypeError("Result type is invalid")
        return res

    def ensure_name_available(self, func):
        def wrapper(*args):
            if args[1] in self._storage:
                raise ICryptoNameOccupiedException
            func(args)
        return wrapper



class ICryptoObjectLockedException:
    pass

class ICryptoNameOccupiedException:
    pass



