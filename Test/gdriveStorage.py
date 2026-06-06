import os
import mimetypes
import tkinter as tk
from tkinter import filedialog, messagebox

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
FOLDER_ID = "1JvAHSI5H7qnNanA9j8kz83nBRxRkhXtq"
SCOPES = ["https://www.googleapis.com/auth/drive"]

root = tk.Tk()
root.title("Google Drive Photo Uploader")
root.geometry("620x240")
root.resizable(False, False)

selected_var = tk.StringVar(value="Selected file: None")
status_var = tk.StringVar(value="Ready.")


def get_drive_service():
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())

    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(port=0, prompt="consent")

    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


def upload_file(file_path):
    service = get_drive_service()
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"

    metadata = {
        "name": os.path.basename(file_path),
        "parents": [FOLDER_ID],
    }

    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

    return service.files().create(
        body=metadata,
        media_body=media,
        fields="id,name,webViewLink"
    ).execute()


def choose_and_upload():
    file_path = filedialog.askopenfilename(
        title="Select a photo",
        filetypes=[
            ("Image files", "*.jpg *.jpeg *.png *.gif *.bmp *.webp"),
            ("All files", "*.*"),
        ],
    )

    if not file_path:
        status_var.set("No file selected.")
        return

    selected_var.set(f"Selected file: {file_path}")
    status_var.set("Uploading...")
    root.update_idletasks()

    try:
        result = upload_file(file_path)
        status_var.set(f"Uploaded: {result.get('name')}")
        messagebox.showinfo(
            "Success",
            f"Uploaded successfully.\n\nName: {result.get('name')}\nFile ID: {result.get('id')}"
        )
    except FileNotFoundError:
        status_var.set("Missing credentials.json.")
        messagebox.showerror(
            "Error",
            f"credentials.json not found here:\n{BASE_DIR}"
        )
    except HttpError as e:
        status_var.set("Upload failed.")
        messagebox.showerror("Google Drive error", str(e))
    except Exception as e:
        status_var.set("Upload failed.")
        messagebox.showerror("Error", str(e))


title = tk.Label(root, text="Google Drive Photo Uploader", font=("Arial", 16, "bold"))
title.pack(pady=14)

btn = tk.Button(root, text="Select Photo and Upload", command=choose_and_upload, width=26, height=2)
btn.pack(pady=8)

selected_label = tk.Label(root, textvariable=selected_var, wraplength=580, justify="left")
selected_label.pack(pady=6)

status_label = tk.Label(root, textvariable=status_var, wraplength=580, justify="left")
status_label.pack(pady=6)

root.mainloop()