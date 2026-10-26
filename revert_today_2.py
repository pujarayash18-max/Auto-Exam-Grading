import json
import os
import re

transcript_path = r"C:\Users\Yash Pujara\.gemini\antigravity-ide\brain\f8d2d0b8-b746-4d33-a48d-cbfbdaa79285\.system_generated\logs\transcript_full.jsonl"

def restore_files():
    first_views = {}
    
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                
                content = data.get('content', '')
                if 'File Path: `file:///' in content:
                    path_match = re.search(r'File Path: `file:///([^`]+)`', content)
                    if path_match:
                        filepath = path_match.group(1).replace('%20', ' ')
                        if not filepath.lower().startswith('c:'):
                            continue
                            
                        if filepath.lower() not in [k.lower() for k in first_views.keys()]:
                            lines = []
                            start_parsing = False
                            for c_line in content.split('\n'):
                                if re.match(r'^\d+:', c_line):
                                    start_parsing = True
                                    lines.append(c_line.split(':', 1)[1].lstrip(' '))
                                elif start_parsing and not c_line.startswith('The above content'):
                                    pass
                            first_views[filepath] = '\n'.join(lines)
            except Exception as e:
                pass

    files_to_restore = [
        r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend\src\app\globals.css",
        r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend\tailwind.config.ts",
        r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend\src\app\layout.tsx",
        r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend\src\components\layout\SuperAdminSidebar.tsx"
    ]
    
    for f in files_to_restore:
        match = next((v for k, v in first_views.items() if k.lower() == f.lower()), None)
        if match:
            with open(f, 'w', encoding='utf-8') as out:
                out.write(match)
            print(f"Restored {f}")
        else:
            print(f"Could not find first view for {f}")

if __name__ == '__main__':
    restore_files()
