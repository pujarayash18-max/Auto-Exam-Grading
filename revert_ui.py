import os

files = [
    'superadmin/dashboard/page.tsx',
    'superadmin/manage-classes/page.tsx',
    'superadmin/manage-students/page.tsx',
    'superadmin/manage-faculty/page.tsx',
    'superadmin/assign-faculty/page.tsx'
]

current_header = '''    <div className="flex flex-col min-h-screen bg-bg text-text selection:bg-primary-blue/30 font-sans">
      <SuperAdminSidebar />

      <main className="flex-1 overflow-y-auto p-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">'''

old_header = '''    <div className="flex h-screen bg-slate-900 text-white selection:bg-blue-500/30 overflow-hidden">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">'''

current_footer = '''          </div>
      </main>
    </div>
  );
}'''

old_footer = '''          </div>
        </div>
      </main>
      
      {/* Background decoration elements */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none z-0"></div>
    </div>
  );
}'''

for f in files:
    path = os.path.join(r'C:\Users\Yash Pujara\Desktop\New folder\AutoExamGrading\frontend\src\app', f)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # We replace the current header with the old one
        content = content.replace(current_header, old_header)
        
        # We replace both variations of the footer
        content = content.replace(current_footer, old_footer)
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
print('Done replacing wrappers')
