import urllib.request, urllib.parse, json, os, mimetypes, uuid

url = 'http://localhost:8000/api/v1/auth/login'
data = urllib.parse.urlencode({'username': 'superadmin', 'password': 'admin'}).encode()
req = urllib.request.Request(url, data=data)
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        token = res['access_token']
except Exception as e:
    print('Login failed:', e)
    exit(1)

print('Logged in, got token')

boundary = uuid.uuid4().hex
file_path = r'C:\Users\Yash Pujara\Desktop\test_faculty_data.csv'
with open(file_path, 'rb') as f:
    file_data = f.read()

body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="update_type"\r\n\r\n'
    f'add\r\n'
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test_faculty_data.csv"\r\n'
    f'Content-Type: text/csv\r\n\r\n'
).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req2 = urllib.request.Request('http://localhost:8000/api/v1/admin/faculty/upload', data=body)
req2.add_header('Authorization', f'Bearer {token}')
req2.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

try:
    with urllib.request.urlopen(req2) as response:
        print('Upload success:', response.read().decode())
except Exception as e:
    print('Upload failed:', e)
    if hasattr(e, 'read'):
        print(e.read().decode())
