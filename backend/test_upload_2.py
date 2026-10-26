import urllib.request, uuid

boundary = uuid.uuid4().hex
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="update_type"\r\n\r\n'
    f'add\r\n'
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n'
    f'Content-Type: text/csv\r\n\r\n'
    f'empID,Department,Faculty-Name,Subject Teaching\r\n1,CS,Test,Test\r\n'
    f'--{boundary}--\r\n'
).encode('utf-8')

import json
url = 'http://localhost:8000/api/v1/auth/login'
data = urllib.parse.urlencode({'username': 'superadmin', 'password': 'admin'}).encode()
req_login = urllib.request.Request(url, data=data)
try:
    with urllib.request.urlopen(req_login) as response:
        res = json.loads(response.read().decode())
        token = res['access_token']
except Exception as e:
    print('Login failed:', getattr(e, 'read', lambda: b'')().decode() or e)
    exit(1)

req = urllib.request.Request('http://localhost:8000/api/v1/admin/faculty/upload', data=body)
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
req.add_header('Authorization', f'Bearer {token}')

try:
    urllib.request.urlopen(req)
except Exception as e:
    print(e)
