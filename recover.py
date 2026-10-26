import json
import os

transcript_paths = [
    r"c:\Users\Yash Pujara\.gemini\antigravity-ide\brain\658e971f-48d2-4a13-9fec-d5a973097ccb\.system_generated\logs\transcript_full.jsonl",
    r"c:\Users\Yash Pujara\.gemini\antigravity-ide\brain\6b9cc1c1-4d90-413c-bff3-2cf849732e84\.system_generated\logs\transcript_full.jsonl"
]
frontend_path = r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend"

file_states = {}

for transcript_path in transcript_paths:
    if os.path.exists(transcript_path):
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    if 'tool_calls' in data:
                        for call in data['tool_calls']:
                            name = call.get('name')
                            args_dict = call.get('args', {})
                            if not args_dict:
                                continue
                            
                            target_file = args_dict.get('TargetFile')
                            if target_file and target_file.lower().startswith(frontend_path.lower()):
                                if name == 'write_to_file':
                                    file_states[target_file] = args_dict.get('CodeContent', '')
                                elif name == 'replace_file_content':
                                    # naive replacement
                                    content = file_states.get(target_file, '')
                                    start_line = args_dict.get('StartLine')
                                    end_line = args_dict.get('EndLine')
                                    replacement = args_dict.get('ReplacementContent', '')
                                    lines = content.split('\n')
                                    if start_line is not None and end_line is not None:
                                        lines[start_line-1:end_line] = replacement.split('\n')
                                        file_states[target_file] = '\n'.join(lines)
                                elif name == 'multi_replace_file_content':
                                    content = file_states.get(target_file, '')
                                    chunks = args_dict.get('ReplacementChunks', [])
                                    # replace from bottom up
                                    chunks = sorted(chunks, key=lambda x: x.get('StartLine', 0), reverse=True)
                                    lines = content.split('\n')
                                    for chunk in chunks:
                                        start_line = chunk.get('StartLine')
                                        end_line = chunk.get('EndLine')
                                        replacement = chunk.get('ReplacementContent', '')
                                        if start_line is not None and end_line is not None:
                                            lines[start_line-1:end_line] = replacement.split('\n')
                                    file_states[target_file] = '\n'.join(lines)
                except Exception as e:
                    pass

for path, content in file_states.items():
    if path.endswith('.tsx') or path.endswith('.ts'):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content.replace('127.0.0.1:8000', '127.0.0.1:8001'))

print("Recovered files:", len([k for k in file_states if k.endswith('.tsx') or k.endswith('.ts')]))
