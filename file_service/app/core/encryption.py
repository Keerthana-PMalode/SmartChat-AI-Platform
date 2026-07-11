from cryptography.fernet import Fernet


def generate_key():

    return Fernet.generate_key()



def encrypt_file(
    data: bytes,
    key: bytes
):

    cipher = Fernet(key)

    return cipher.encrypt(data)



def decrypt_file(
    data: bytes,
    key: bytes
):

    cipher = Fernet(key)

    return cipher.decrypt(data)