import json
import os
import shutil

transcript_path = r"C:\Users\Yash Pujara\.gemini\antigravity-ide\brain\f8d2d0b8-b746-4d33-a48d-cbfbdaa79285\.system_generated\logs\transcript_full.jsonl"
frontend_path = r"c:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend"

file_states = {}
seen_files = set()

# Reverse parsing to find the initial state? Or forward parsing?
# Forward parsing: the first time we see `TargetContent` in `replace_file_content`
# we can use that if we don't have a view_file output. 
# But wait, view_file doesn't have the original content in the arguments, it's in the tool response!
# This might be tricky.

# Let's use `revert_ui.py` logic which reverted wrappers, but maybe I changed other things?
# Actually, I can just use git for the tracked files in the parent repo.
# What if the user is using `git reset --hard` but they didn't know how to clean?

# Let's write the first TargetContent we see for each file to memory.
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
                    if target_file:
                        if target_file not in seen_files:
                            # We need the full original file! But replace_file_content only has a chunk.
                            pass
        except Exception:
            pass

# Moving middleware back
mid_src = os.path.join(frontend_path, "src", "middleware.ts")
mid_dest = os.path.join(frontend_path, "middleware.ts")
if os.path.exists(mid_src):
    shutil.move(mid_src, mid_dest)
    print("Moved middleware.ts back to root")

