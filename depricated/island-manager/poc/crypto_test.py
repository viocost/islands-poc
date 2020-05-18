import unittest
from lib.icrypto import ICrypto

class TestConfig(unittest.TestCase):

    def test_getters_setters(self):
        self.ic = ICrypto()
        self.ic.add_blob("test", "Hello world")
        assert self.ic["test"] == "Hello world"

    def test_key_creation(self):
        self.ic = ICrypto()
        self.ic.add_blob("boo", "Hello world")\
            .create_rsa_keypair("keys")
        print(self.ic["keys"])

    def test_file_hash(self):
        self.ic = ICrypto()
        path = "D:\\downloads\\10126usb.iso"
        self.ic.hash_file("h", path)
        print(self.ic["h"])






    def test_key_creation(self):
        self.ic = ICrypto()
        self.ic.add_blob("boo", "Hello world")\
            .create_rsa_keypair("keys")\
            .encrypt_private_key("pem", "keys", bytes("blablabla", "utf8"))
        print(self.ic["pem"])
        print(self.ic["keys"])
        with open("key.pem", "wb") as f:
            f.write(self.ic["pem"])

    def test_priv_key_dump(self):
        self.ic = ICrypto()
        self.ic.add_blob("boo", "Hello world") \
            .create_rsa_keypair("keys") \
            .encrypt_private_key("pem", "keys", bytes("blablabla", "utf8"))
        print(self.ic["pem"])
        print(self.ic["keys"])
        with open("key.pem", "wb") as f:
            f.write(self.ic["pem"])

        self.read_key()

    def read_key(self):
        with open("key.pem", "rb") as f:
            data = f.read()
            ic = ICrypto()
            ic.load_pem_private_key("priv", data, "blablabla")
            print(ic["priv"])

    def test_pkfp(self):
        with open("key.pem", "rb") as f:
            data = f.read()
            ic = ICrypto()
            ic.load_pem_private_key("priv", data, "blablabla") \
                .public_from_private("pub", "priv") \
                .get_public_key_fingerprint("pkfp", "pub")
            print(str(ic["priv"], "utf8"))
            print(str(ic["pub"], "utf8"))
            with open("pub.pem", "wb") as pubf:
                pubf.write(ic["pub"])
            print("PKFP: " + str(ic["pkfp"], "utf8"))
