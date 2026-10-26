import pandas as pd
import os

desktop_path = r"C:\Users\Yash Pujara\Desktop"

# Faculty Data
faculty_data = {
    'Sr.No': [1, 2],
    'empID': ['F001', 'F002'],
    'Department': ['Computer Engineering', 'Computer Engineering'],
    'Faculty-Name': ['Dr. Alice Smith', 'Prof. Bob Jones'],
    'Subject Teaching': ['Data Structures', 'Algorithms']
}
faculty_df = pd.DataFrame(faculty_data)
faculty_df.to_excel(os.path.join(desktop_path, 'faculty_data.xlsx'), index=False)

# Student Data
student_data = {
    'Sr.No': [1, 2, 3],
    'Enrollment Number': ['EN2024001', 'EN2024002', 'EN2024003'],
    'GR Number': ['GR101', 'GR102', 'GR103'],
    'Name': ['Charlie Brown', 'Diana Prince', 'Eve Adams'],
    'Class': ['A', 'A', 'B'],
    'Department': ['Computer Engineering', 'Computer Engineering', 'Computer Engineering'],
    'Semester': [3, 3, 3],
    'Subject1': ['Data Structures', 'Data Structures', 'Algorithms'],
    'Subject2': ['Algorithms', 'Operating Systems', 'Data Structures']
}
student_df = pd.DataFrame(student_data)
student_df.to_excel(os.path.join(desktop_path, 'student_data.xlsx'), index=False)

# Class Data
class_data = {
    'Semester': [3, 3, 5],
    'Class': ['A', 'B', 'C']
}
class_df = pd.DataFrame(class_data)
class_df.to_excel(os.path.join(desktop_path, 'class_data.xlsx'), index=False)

print("Excel sheets generated successfully on the Desktop.")
