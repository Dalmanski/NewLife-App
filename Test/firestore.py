import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

collection_name = "users"
document_id = "2"

# Path to your service account JSON
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(
    BASE_DIR,
    "newlife-app-437b9-firebase-adminsdk-fbsvc-738cc49b2b.json"
)

cred = credentials.Certificate(cred_path)

# جلوگیری duplicate initialization
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

doc_ref = db.collection(collection_name).document(document_id)
doc = doc_ref.get()

if doc.exists:
    data = doc.to_dict()

    # Convert to JSON format (pretty print)
    json_data = json.dumps(data, indent=4, default=str)

    print("Document in JSON format:")
    print(json_data)
else:
    print("Document does not exist")