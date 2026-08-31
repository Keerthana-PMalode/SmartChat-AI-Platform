import os

from cryptography.fernet import Fernet


def generate_key():

    return Fernet.generate_key()


def encrypt_file(data: bytes, key: bytes):

    cipher = Fernet(key)

    return cipher.encrypt(data)


def decrypt_file(data: bytes, key: bytes):

    cipher = Fernet(key)

    return cipher.decrypt(data)


def get_master_key():

    master_key = os.getenv("FILE_MASTER_KEY")

    if not master_key:
        raise RuntimeError("FILE_MASTER_KEY environment variable is not configured")

    return master_key.encode()


def encrypt_key(file_key: bytes):

    master_key = get_master_key()

    cipher = Fernet(master_key)

    return cipher.encrypt(file_key)


def decrypt_key(encrypted_key: bytes):

    master_key = get_master_key()

    cipher = Fernet(master_key)

    return cipher.decrypt(encrypted_key)
