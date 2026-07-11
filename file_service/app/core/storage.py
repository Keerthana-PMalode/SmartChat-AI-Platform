import os


STORAGE_DIR="uploads"


os.makedirs(
    STORAGE_DIR,
    exist_ok=True
)



def save_encrypted_file(
    filename,
    data
):

    path=os.path.join(
        STORAGE_DIR,
        filename
    )


    with open(
        path,
        "wb"
    ) as f:

        f.write(data)


    return path
