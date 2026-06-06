import os
import sys
import uuid
import mimetypes
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "").strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "images").strip()
SUPABASE_BUCKET_PUBLIC = os.getenv("SUPABASE_BUCKET_PUBLIC", "true").strip().lower() == "true"

def fail(message):
    print(message)
    sys.exit(1)

def get_client():
    if not SUPABASE_URL:
        fail("Missing SUPABASE_URL")
    if not SUPABASE_SECRET_KEY:
        fail("Missing SUPABASE_SECRET_KEY")
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

def ensure_bucket_exists(supabase):
    try:
        supabase.storage.get_bucket(SUPABASE_BUCKET)
        return
    except Exception:
        supabase.storage.create_bucket(
            SUPABASE_BUCKET,
            options={
                "public": SUPABASE_BUCKET_PUBLIC
            }
        )

def upload_image(image_path):
    supabase = get_client()

    path = Path(image_path)
    if not path.exists() or not path.is_file():
        fail("File not found.")

    ensure_bucket_exists(supabase)

    mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    ext = path.suffix if path.suffix else ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    remote_path = f"uploads/{unique_name}"

    with open(path, "rb") as f:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=remote_path,
            file=f,
            file_options={
                "content-type": mime_type,
                "upsert": "true"
            }
        )

    print("Uploaded successfully.")
    print("Bucket:", SUPABASE_BUCKET)
    print("Path:", remote_path)

    if SUPABASE_BUCKET_PUBLIC:
        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(remote_path)
        print("Public URL:", public_url)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        image_path = input("Enter image path: ").strip().strip('"').strip("'")
    else:
        image_path = sys.argv[1].strip().strip('"').strip("'")

    upload_image(image_path)