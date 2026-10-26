import pandas as pd
import os

# Sample data for classes
data = {
    'Department': [
        'Computer Engineering', 'Computer Engineering', 'Computer Engineering', 'Computer Engineering',
        'Computer Engineering', 'Computer Engineering', 'Computer Engineering', 'Computer Engineering',
        'ICT', 'ICT', 'ICT', 'ICT', 'ICT', 'ICT', 'ICT', 'ICT'
    ],
    'Semester': [
        1, 1, 3, 3, 5, 5, 7, 7,
        1, 1, 3, 3, 5, 5, 7, 7
    ],
    'Class': [
        'EC1', 'EC2', 'EC1', 'EC2', 'EC1', 'EC2', 'EC1', 'EC2',
        'EV1', 'EV2', 'EV1', 'EV2', 'EV1', 'EV2', 'EV1', 'EV2'
    ]
}

df = pd.DataFrame(data)

# Save to Desktop
desktop_path = r'C:\Users\Yash Pujara\Desktop\Classes.xlsx'
df.to_excel(desktop_path, index=False)
print(f"Successfully created {desktop_path}")
