from lib.icrypto import ICrypto
from lib.util import get_full_path, get_stack
from lib.exceptions import KeyImportError
import os
import datetime as dt
import time
import json
import logging
import shutil

PASSWORD_LENGTH = 1
KEY_INFO_FILENAME = "key.info"
PRIVATE_KEY_FILENAME = "private.pem"
PUBLIC_KEY_FILENAME = "public.pem"

log = logging.getLogger(__name__)

class KeyManager:
    def __init__(self, config):

        self.user_keys_path = get_full_path(config["user_keys_path"])
        self.trusted_keys_path = get_full_path(config["trusted_keys_path"])


    def get_user_private_keys_info(self):
        """
        Gets info of all user keys and returns it in form of dictionary:
        {
            "pkfp": {
                "pkfp": "pkfp",
                "alias": "alias",
                "created": <date>
            }
        }
        "pkfp is public key SHA256"
        :return:
        """
        keys = os.listdir(get_full_path(self.user_keys_path))
        res = {}
        for key in keys:
            try:
                with open(get_full_path(os.path.join(self.user_keys_path, key, KEY_INFO_FILENAME)), "r") as fp:
                    res[key] = json.load(fp)
            except Exception as e:
                log.error("Error getting key info: %s " % str(e))
        return res

    def get_trusted_keys_info(self):
        keys = os.listdir(get_full_path(self.trusted_keys_path))
        res = {}
        for key in keys:
            try:
                with open(get_full_path(os.path.join(self.trusted_keys_path, key, KEY_INFO_FILENAME)), "r") as fp:
                    res[key] = json.load(fp)
            except Exception as e:
                log.error("Error getting key info: %s " % str(e))
        return res

    def import_private_key(self, new_password, existing_password=None, alias=None, key_data=None, filepath=None):
        if not key_data:
            if not filepath:
                raise KeyImportError("Neither key_data nor filepath provided")
            with open(filepath, "rb") as fp:
                key_data = fp.read()
        try:
            ic = ICrypto()
            ic.load_pem_private_key("k", key_data, existing_password)\
                .public_from_private("pub", "k") \
                .get_public_key_fingerprint("pkfp", "pub") \
                .encrypt_private_key("kenc", "k", bytes(new_password, "utf8"))

            logging.debug("Private key loaded successfully. Saving...")
            self.save_user_key(
                pkfp=ic["pkfp"],
                public=ic["pub"],
                private=ic["kenc"],
                alias=alias
            )

        except Exception as e:
            logging.error(str(e))
            raise KeyImportError(e)

    def import_public_key(self, key_data=None, filepath=None, alias=None):
        """
        Adds given public key to the trusted keys storage and registers it as trusted
        :param key_data: Must be not encoded
        :param filepath:
        :param alias:
        :return:
        """
        if not (key_data or filepath):
            raise KeyImportError("Neither key_data nor filepath provided")
        if filepath:
            with open(filepath, "rb") as fp:
                key_data = fp.read()
        try:
            ic = ICrypto()
            ic.load_pem_public_key("pub", key_data) \
                .get_public_key_fingerprint("pkfp", "pub")
            self.save_trusted_public_key(
                pkfp=ic["pkfp"],
                public=ic["pub"],
                alias=alias
            )
        except Exception as e:
            logging.error(e)
            raise KeyImportError(e)

    def generate_encrypted_user_key(self, password, size=2048):
        """
        Creates new private key and saves it in the key folder
        :param password: String password in utf8 format
        :note String: arbitrary note for user's reference
        :param size:
        :return:
        """
        ic = ICrypto()
        ic.create_rsa_keypair("k") \
            .public_from_private("pub", "k") \
            .get_public_key_fingerprint("pkfp", "pub") \
            .encrypt_private_key("kenc", "k", bytes(password, "utf8"))
        return {
            "pkfp": ic["pkfp"],
            "public": ic["pub"],
            "private": ic["kenc"]
        }

    def save_user_key(self, pkfp, public, private, alias=None):
        """
        Saves private key on disk.
        Assumed that all checks are already completed.
        If folder exists - files with the same names will be replaced.
        :param pkfp: Public key fingerprint SHA256
        :param public: Public key derived from private key
        :param private: Encrypted private key
        :param alias: User note
        :return:
        """
        keyfolder = get_full_path(os.path.join(self.user_keys_path, str(pkfp, "utf8")))
        if not os.path.isdir(keyfolder):
            os.mkdir(keyfolder)
        with open(os.path.join(keyfolder, "public.pem"), "wb") as pubf, \
                open(os.path.join(keyfolder, "private.pem"), "wb") as privf, \
                open(os.path.join(keyfolder, KEY_INFO_FILENAME), "w") as nf:
            pubf.write(public)
            privf.write(private)
            key_info = dict()
            key_info["created"] = str(dt.datetime.fromtimestamp(time.time()))
            key_info["pkfp"] = str(pkfp, "utf8")
            if alias is not None:
                key_info["alias"] = alias
            json.dump(key_info, nf)

    def save_trusted_public_key(self, pkfp, public, alias=None):
        keyfolder = get_full_path(os.path.join(self.trusted_keys_path, str(pkfp, "utf8")))
        if not os.path.isdir(keyfolder):
            os.mkdir(keyfolder)

        with open(os.path.join(keyfolder, "public.pem"), "wb") as pubf, \
                open(os.path.join(keyfolder, KEY_INFO_FILENAME), "w") as nf:
            pubf.write(public)
            key_info = dict()
            key_info["created"] = str(dt.datetime.fromtimestamp(time.time()))
            key_info["pkfp"] = str(pkfp, "utf8")
            if alias is not None:
                key_info["alias"] = alias
            json.dump(key_info, nf)

    def is_key_trusted(self, pkfp):
        """
        Given public key fingerprint checks if it is registered as trusted key
        :param pkfp: utf8 encoded public key fingerprint
        :return:
        """
        key_path = None
        if pkfp in os.listdir(self.trusted_keys_path):
            log.debug("pkfp found in trusted keys")
            key_path = os.path.join(self.trusted_keys_path, pkfp)
        elif pkfp in os.listdir(self.user_keys_path):
            log.debug("pkfp found in user keys")
            key_path = os.path.join(self.user_keys_path, pkfp)
        else:
            log.debug("pkfp not recognized as trusted")
            return False
        with open(os.path.join(key_path, "public.pem"), "rb") as fp:
            log.debug("Checking public key")
            ic = ICrypto()
            ic.load_pem_public_key("pub", fp.read())    \
                .get_public_key_fingerprint("pkfp", "pub")
            return str(ic["pkfp"], "utf8") == pkfp

    def update_key_alias(self, pkfp, alias, is_private=False):
        log.debug("Updating key %s  alias to %s " % (pkfp, alias))
        base_path = self.user_keys_path if is_private else self.trusted_keys_path
        key_path = os.path.join(base_path, pkfp)
        key_info_path = os.path.join(key_path, KEY_INFO_FILENAME)
        if not os.path.exists(key_info_path):
            log.error("Key not found! Path: %s " % key_info_path)
            raise FileNotFoundError("Key not found")
        with open(key_info_path, "r+") as fp:
            data = json.load(fp)
            data["alias"] = alias
            fp.truncate(0)
            fp.seek(0)
            json.dump(data, fp)
            log.debug("Key alias updated!")

    def delete_key(self, pkfp, is_private=False):
        log.debug("Deleting key %s" % pkfp)
        base_path = self.user_keys_path if is_private else self.trusted_keys_path
        key_path = os.path.join(base_path, pkfp)
        if not os.path.exists(key_path):
            log.exception("Key not found! Path: %s\n%s " % (key_path, get_stack()))
            raise FileNotFoundError("Key not found")
        shutil.rmtree(key_path)
        log.debug("Key has been removed successfully!")

    def get_private_key_data(self, pkfp):
        """
        :param pkfp: Must be utf8 string
        :return:
        """
        key_dir = self.get_key_path(pkfp, True)
        key_path = os.path.join(key_dir,  PRIVATE_KEY_FILENAME)
        with open(key_path, "rb") as fp:
            return fp.read()

    def get_key_path(self, pkfp, is_private=False):
        """
        pkfp must be a utf8 string
        :param pkfp:
        :param is_private:
        :return:
        """
        return os.path.join(self.user_keys_path, pkfp) if is_private else \
            os.path.join(self.trusted_keys_path, pkfp)
