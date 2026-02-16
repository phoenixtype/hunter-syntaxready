import { CandidateProfile } from "./resume_engine";

/**
 * Generate a printable ATS-optimized resume as an HTML string,
 * then trigger browser print dialog for PDF export.
 * ATS systems parse simple, clean HTML/PDF much better than complex layouts.
 */
export const exportResumeToPdf = (profile: CandidateProfile, coverLetter?: string) => {
    const { identity, skills, experience_atoms, education } = profile;

    const resumeHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${identity.name} - Resume</title>
    <style>
        @page { margin: 0.75in; size: letter; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #1a1a1a;
            max-width: 8.5in;
        }
        h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4pt; }
        h2 {
            font-size: 12pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1.5px solid #333;
            padding-bottom: 3pt;
            margin: 14pt 0 8pt 0;
        }
        h3 { font-size: 11pt; font-weight: bold; }
        .contact { font-size: 10pt; color: #444; margin-bottom: 2pt; }
        .contact a { color: #444; text-decoration: none; }
        .role-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8pt; }
        .company { font-style: italic; color: #333; }
        .duration { font-size: 10pt; color: #555; }
        .bullet { margin: 3pt 0 3pt 18pt; text-indent: -12pt; }
        .bullet::before { content: "• "; }
        .skills-list { margin: 4pt 0; }
        .edu-item { margin: 6pt 0; }
        .section { page-break-inside: avoid; }
        ${coverLetter ? `
        .page-break { page-break-before: always; }
        .cover-letter { margin-top: 0; }
        .cover-letter p { margin: 8pt 0; }
        ` : ''}
    </style>
</head>
<body>
    <!-- RESUME -->
    <div>
        <h1>${escapeHtml(identity.name)}</h1>
        <div class="contact">
            ${identity.email ? escapeHtml(identity.email) : ''}
            ${identity.links?.length ? ' | ' + identity.links.map(l => `<a href="${escapeHtml(l)}">${escapeHtml(l.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(' | ') : ''}
        </div>

        <!-- SKILLS -->
        <div class="section">
            <h2>Skills</h2>
            <div class="skills-list">
                ${skills
                    .sort((a, b) => b.proficiency - a.proficiency)
                    .map(s => escapeHtml(s.name))
                    .join(' • ')
                }
            </div>
        </div>

        <!-- EXPERIENCE -->
        <div class="section">
            <h2>Professional Experience</h2>
            ${experience_atoms.map(exp => `
                <div class="role-header">
                    <div>
                        <h3>${escapeHtml(exp.role)}</h3>
                        <span class="company">${escapeHtml(exp.company)}</span>
                    </div>
                    <span class="duration">${escapeHtml(exp.duration || '')}</span>
                </div>
                <div class="bullet">${escapeHtml(exp.content)}</div>
            `).join('')}
        </div>

        <!-- EDUCATION -->
        ${education.length > 0 ? `
        <div class="section">
            <h2>Education</h2>
            ${education.map(edu => `
                <div class="edu-item">
                    <h3>${escapeHtml(edu.degree)}</h3>
                    <span class="company">${escapeHtml(edu.school)}</span>
                    ${edu.year ? ` <span class="duration">${escapeHtml(edu.year)}</span>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>

    ${coverLetter ? `
    <!-- COVER LETTER -->
    <div class="page-break cover-letter">
        <h1>${escapeHtml(identity.name)}</h1>
        <div class="contact">${identity.email ? escapeHtml(identity.email) : ''}</div>
        <h2>Cover Letter</h2>
        ${coverLetter.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('')}
    </div>
    ` : ''}
</body>
</html>`;

    // Open in a new window and trigger print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(resumeHtml);
        printWindow.document.close();
        // Give a brief moment for rendering before print dialog
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
};

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
