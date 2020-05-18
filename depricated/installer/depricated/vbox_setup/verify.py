#
# This script verifies the signature of the Islands source code
import os, sys
import zipfile

from  cryptography.hazmat.primitives import hashes



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

def pack_n_sign(source_dir, private_key):
    # zip source
    if not os.path.exists(source_dir):
        raise "Source directory is not found"

    make_zipfile("source.zip", source_dir)
   
    # sign zip
    # zip zipped source and sign together
    pass


def verify(source_file, sign, public_key):
    pass




def main():
    source_path = sys.argv[1]
    pack_n_sign(source_path, "sdfh")

if __name__ == "__main__":
    main()
