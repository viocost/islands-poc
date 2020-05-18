from lib.icrypto import ICrypto
from lib.exceptions import ImageAuthoringError
from lib.util import read_file_in_chunks, get_stack
import logging
import os
import json
import time
import datetime
import zipfile
from shutil import rmtree
from lib.image_verification_error import ImageVerificationError



log = logging.getLogger(__name__)
IMAGE_DIR_NAME = "islands_image/"
IMAGE_INFO_FILENAME = "info.json"
IMAGE_FILENAME = "islands.ova"
INFO_SIGNATURE_FILENAME = "info.signature"


class ImageAuthoring:
    def __init__(self, config, key_manager):
        self.key_manager = key_manager
        self.config = config
        self.authoring_protocol = self.config["authoring_protocol"]

    def create_random_temp_folder(self):
        res = None
        return res

    def author_image(self,
                     image_version,
                     islands_version,
                     path_to_image,
                     output_path,
                     output_filename,
                     publisher=None,
                     note=None,
                     key_data=None,
                     key_path=None,
                     key_password=None,
                     hash_algorithm="sha256"):
        log.info("Authoring image", locals())
        log.debug("Checking arguments")

        try:

            self.verify_input(key_data=key_data, key_path=key_path, output_path=output_path, path_to_image=path_to_image)

            temp_dir = self.make_temp_dir(output_path)
            log.debug("Arguments checked")
            if not key_data:
                key_data = self.get_key_data(key_path)
            ic = self.sign_source(key_data, key_password, path_to_image)
            self.create_info(ic, image_version, islands_version, note, publisher, temp_dir)
            self.sign_info(ic, temp_dir)
            self.write_image(path_to_image, temp_dir)
            path_to_res = self.zip_up(output_filename, output_path, temp_dir)
            self.cleanup(temp_dir)
            return path_to_res
        except Exception as e:
            raise e
        finally:
            if temp_dir is not None and os.path.isdir(temp_dir):
                rmtree(temp_dir)

    def verify_input(self, key_data, output_path, path_to_image, key_path=None):
        if not os.path.isdir(output_path):
            raise ImageAuthoringError("Output path is not a valid directory")
        if not os.path.exists(path_to_image):
            raise ImageAuthoringError("Image file not found")
        if not key_data and not key_path:
            raise ImageAuthoringError("Private key was not provided")

    def make_temp_dir(self, output_path):
        temp_dir = os.path.join(output_path, IMAGE_DIR_NAME)
        if os.path.isdir(temp_dir):
            raise ImageAuthoringError("Directory %s already exists. Please delete or rename it to proceed." % temp_dir)
        os.mkdir(temp_dir)
        return temp_dir

    def cleanup(self, temp_dir):
        rmtree(temp_dir)
        log.debug("Done authoring image")

    def zip_up(self, output_filename, output_path, temp_dir):
        log.info("File copied. Creating a zip archive.")
        if not output_filename.endswith(".%s" % self.config["islands_vm_extension"]):
            output_filename += ".%s" % self.config["islands_vm_extension"]
        path_to_res_image = os.path.join(output_path, output_filename)
        self.make_zipfile(path_to_res_image, temp_dir)
        log.info("Archive created. Removing temp directory")
        return path_to_res_image

    def write_image(self, path_to_image, temp_dir):
        with open(path_to_image, "rb") as source, \
                open(temp_dir + IMAGE_FILENAME, "wb") as dest:
            for chunk in read_file_in_chunks(source):
                dest.write(chunk)

    def sign_info(self, ic, temp_dir):
        log.debug("Hashing and signing info")
        ic.hash_file("infohash", os.path.join(temp_dir, IMAGE_INFO_FILENAME)) \
            .private_key_sign("infosign", "infohash", "priv") \
            .public_key_verify("res", "infohash", "pub", "infosign")
        with open(temp_dir + INFO_SIGNATURE_FILENAME, "wb") as fp:
            fp.write(ic["infosign"])
        log.info("Image info signature written. Now copying the image")

    def sign_source(self, key_data, key_password, path_to_image):
        ic = ICrypto()
        log.debug("Processing private key...")
        log.debug("key data %s" % str(key_data))
        log.debug("key password %s " % str(key_password))
        ic.load_pem_private_key("priv", key_data, key_password) \
            .public_from_private("pub", "priv") \
            .get_public_key_fingerprint("pkfp", "pub") \
            .hash_file("hash", path_to_image) \
            .private_key_sign("sign", "hash", "priv")
        log.debug("Crypto complete")
        return ic

    def create_info(self, ic, image_version, islands_version, note, publisher, temp_dir, email, hash_algorithm="sha256"):
        log.debug("Creating file info")
        info = dict()
        info["image_version"] = image_version
        info["islands_version"] = islands_version
        info["hash_algorithm"] = hash_algorithm
        info["hash"] = str(ic["hash"], "utf8")
        info["time_created"] = datetime.datetime.fromtimestamp(time.time()).strftime('%Y-%m-%d %H:%M:%S')
        info["publisher"] = publisher
        info["note"] = note
        info["email"] = email
        info["authoring_protocol"] = self.authoring_protocol
        info["public_key"] = str(ic["pub"], "utf8")
        info["pkfp"] = str(ic["pkfp"], "utf8")
        info["sign"] = str(ic["sign"], "utf8")
        log.info("Writing image info file")
        with open(temp_dir + IMAGE_INFO_FILENAME, "w") as fp:
            json.dump(info, fp)
        return info

    def make_zipfile(self, output_filename, source_dir):
        relroot = os.path.abspath(os.path.join(source_dir, os.pardir))
        with zipfile.ZipFile(output_filename, "w", zipfile.ZIP_DEFLATED) as zip:
            for root, dirs, files in os.walk(source_dir):
                # add directory (needed for empty dirs)
                zip.write(root, os.path.relpath(root, relroot))
                for file in files:
                    filename = os.path.join(root, file)
                    if os.path.isfile(filename):  # regular files only
                        arcname = os.path.join(os.path.relpath(root, relroot), file)
                        zip.write(filename, arcname)

    def get_key_data(self, key_path):
        with open(key_path, "rb") as fp:
            return fp.read()


    def verify_image(self, temp_dir):
        """
        Given the path to temporary directory where image data has been unpacked
        scans the structure of the image data and verifies hashes and signatures
        Also checks if public key is trusted
        :param temp_dir: temporary directory where content of zip archive was unpacked
                         it should be a folder with 3 files in it
        :return: list of found errors. List will be empty if no errors found
                 Errors come from ImageVerificationError enum
        """
        errors = []
        image_dir = os.path.join(temp_dir, self.config["image_dirname"])
        try:
            path_to_image, path_to_info, path_to_signature = self._get_paths(image_dir)
        except InvalidImageContent as e:
            log.info("Invalid image content.")
            errors.append(ImageVerificationError.IMAGE_DATA_INVALID)
            return errors
        except Exception as e:
            log.exception(e)
            raise e

        info, info_sign = None, None

        ic = ICrypto()
        # load info
        with open(path_to_info, "r") as info_fp, \
            open(path_to_signature, "rb") as sign_fp:
            info = json.load(info_fp)
            info_sign = sign_fp.read()

        # checking protocol
        if "authoring_protocol" not in info or info["authoring_protocol"] != self.authoring_protocol:
            log.exception("Authoring protocol don't match! \n%s" % get_stack())
            errors.append(ImageVerificationError.AUTHORING_PROTOCOL_MISMATCH)

        ic.hash_file("image_hash", path_to_image)
        image_hash = ic["image_hash"]
        if bytes(info["hash"], "utf8") != image_hash:
            log.error("Image hash does not match with hash specified in the info: \n%s\n%s" % (str(image_hash), str(info["hash"])))
            errors.append(ImageVerificationError.HASH_MISMATCH)

        try:
            ic.hash_file("infohash", path_to_info) \
                .add_blob("sign", info_sign) \
                .load_pem_public_key("pub", bytes(info["public_key"], "utf8")) \
                .public_key_verify("res_infohash", "infohash", "pub", "sign") \
                .get_public_key_fingerprint("pkfp", "pub") \
                .add_blob("image_hash", image_hash) \
                .add_blob("image_sign", bytes(info["sign"], "utf8")) \
                .public_key_verify("res_image", "image_hash", "pub", "image_sign")
        except Exception as e:
            errors.append(ImageVerificationError.CRYPTO_ERROR)
            return errors

        if ic["res_infohash"] is False:
            log.error("Info signature is invalid")
            errors.append(ImageVerificationError.INFO_SIGNATURE_INVAILD)


        if ic["res_image"] is False:
            log.error("Image signature is invalid")
            errors.append(ImageVerificationError.IMAGE_SIGNATURE_INVALID)

        if ic["pkfp"] != bytes(info["pkfp"], "utf8"):
            msg = "Pkfp does not match"
            log.error("Pkfp does not match")
            errors.append(msg)

        log.info("Checking if pkfp is in trusted keys...")
        if not self.key_manager.is_key_trusted(str(ic["pkfp"], "utf8")):
            log.error("Key is not trusted")
            errors.append(ImageVerificationError.KEY_NOT_TRUSTED)
        return errors

    def get_image_content_paths(self, temp_dir):
        image_dir = os.path.join(temp_dir, self.config["image_dirname"])
        return self._get_paths(image_dir)

    def get_path_to_vm_image(self, temp_dir):
        """
        Given path to temporary directory where isld file was unpacked
        returns path to actual vm image file
        :param temp_dir:
        :return: path to image file
        """
        image_dir = os.path.join(temp_dir, self.config["image_dirname"])
        return self._get_paths(image_dir)[0]

    def add_trusted_key(self, temp_dir):
        image_dir = os.path.join(temp_dir, self.config["image_dirname"])
        info_file = self._get_paths(image_dir)[1]
        with open(info_file, "r") as fp:
            data = json.load(fp)
            log.debug("Adding trusted key: %s " % data["public_key"])
            self.key_manager.import_public_key(bytes(data["public_key"], "utf8"))

    def _get_paths(self, image_dir):
        """
        Given path to image dir returns tuple of paths to each file
        in order image_file, info_file, signature
        :param image_dir:
        :return:
        """
        image_file = None
        info_file = None
        sign_file = None
        for file in os.listdir(image_dir):
            if file.endswith(self.config["image_file_ext"]):
                image_file = os.path.join(image_dir, file)
            elif file.endswith(self.config["image_info_ext"]):
                info_file = os.path.join(image_dir, file)
            elif file.endswith(self.config["image_info_signature_ext"]):
                sign_file = os.path.join(image_dir, file)
            else:
                raise InvalidImageContent("Image data is invalid")
        if not (image_file and info_file and sign_file):
            raise InvalidImageContent("Image data is missing")
        return image_file, info_file, sign_file


class InvalidImageContent(Exception):
    pass




"""
Image file is formed as follows:

    image_dir
        image.ova
        
        # File encoding must be utf8
        # ALL hashes and signatures are hexified
        
        info.json  
            {
                "authoring_protocol": "0.54.34",
                "imageVersion": "0.432.3",
                "islandsVersion": "0.321.43",
                "hash_type": "sha256",
                "hash": "the_hash",
                "publisher": "Publisher name",
                "publisher email": "email",
                "public_key": "public_key",  //publisher public key
                "public_key_fingerprint": "some_pkfp",  //publisher public key hash sha256,
                "note": "some_note",
                "sign": "hash signature by the owner of private key",                
            }
            
        # encoding binary
        # Hexified signature of the info.json            
        info.signature
            
            image.nfo file signature by the owner of private key
    
    
    ***************
    
    then image_dir zipped                        
"""

