
import os
import firebase_admin
from firebase_admin import credentials, firestore
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(
    BASE_DIR,
    "newlife-app-437b9-firebase-adminsdk-fbsvc-738cc49b2b.json"
)
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

db = firestore.client()

def serialize_firestore(doc):
    data = doc.to_dict()
    data["id"] = doc.id
    return data

def load_collection(collection_name):
    docs = db.collection(collection_name).stream()
    result = [serialize_firestore(doc) for doc in docs]
    return result

all_data = {}

collections = db.collections()

for collection in collections:
    name = collection.id
    all_data[name] = load_collection(name)

print(json.dumps(all_data, indent=2, default=str))