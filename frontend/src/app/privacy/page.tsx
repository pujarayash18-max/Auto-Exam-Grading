import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-6 sm:px-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-border pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mt-1">Last updated: October 2026</p>
          </div>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to Login
          </Link>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">1. Overview</h2>
          <p>
            AutoExam Grading provides an academic evaluation and examination platform designed for higher education institutions. This Privacy Policy details our principles and procedures regarding the collection, handling, and security of data collected during examination workflows, including candidate performance records, transcripts, and faculty assessments.
          </p>

          <h2 className="text-lg font-semibold text-foreground">2. Information Collection</h2>
          <p>
            We collect academic credentials necessary to authenticate student, faculty, and administrative users. During oral examination (viva) sessions, the system processes audio recordings, generated question sets, transcripts, and scoring metrics strictly for academic evaluation and institutional auditing.
          </p>

          <h2 className="text-lg font-semibold text-foreground">3. Usage of Data</h2>
          <p>
            Candidate responses and evaluation data are processed exclusively for scoring, faculty oversight, and institutional grade reporting. Examination materials and audio logs are never commercialized, sold, or shared with unauthorized third parties.
          </p>

          <h2 className="text-lg font-semibold text-foreground">4. Storage and Security</h2>
          <p>
            All assessment data and associated records are stored using industry-standard encryption protocols in transit and at rest. Access is governed by role-based access controls restricted to authorized departmental administrators and evaluating faculty.
          </p>

          <h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
          <p>
            Examination transcripts and audio logs are retained in accordance with institutional data retention schedules and academic accreditation requirements. Inquiries regarding student records should be directed to the respective institution's academic administration.
          </p>
        </section>

        <div className="pt-8 border-t border-border text-xs text-muted-foreground">
          AutoExam Grading Institutional Academic Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}
