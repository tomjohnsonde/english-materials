globalThis.siteData = {
  navigation: [
    { label: 'Home', href: 'index.html', page: 'home' },
    { label: 'Grammar', href: 'grammar.html', page: 'grammar' },
    { label: 'Medical English', href: 'medical-english.html', page: 'medical' },
    { label: 'Speaking', href: 'speaking.html', page: 'speaking' },
    { label: 'All materials', href: 'library.html', page: 'library' }
  ],
  sections: [
    { slug: 'grammar', title: 'Grammar', href: 'grammar.html', group: 'Language', desc: 'Conditionals, verb tenses, linking words and grammar practice.' },
    { slug: 'medical', title: 'Medical English', href: 'medical-english.html', group: 'Language', desc: 'Healthcare vocabulary, reports and specialist discussion tasks.' },
    { slug: 'speaking', title: 'Speaking', href: 'speaking.html', group: 'Skills', desc: 'Discussion topics, telephone dialogues and role plays.' },
    { slug: 'business-1', title: 'VHS — Business Intermediate', href: 'section.html?section=business-1', group: 'Business', desc: 'Business-intermediate course archive.', available: false },
    { slug: 'business-2', title: 'VHS Business Int Course 2', href: 'section.html?section=business-2', group: 'Business', desc: 'Business course resources and current lesson links.', available: false },
    { slug: 'collocations', title: 'Collocations', href: 'section.html?section=collocations', group: 'Language', desc: 'Natural word combinations, make/do and topic vocabulary.' },
    { slug: 'pronunciation', title: 'Pronunciation & Spelling', href: 'section.html?section=pronunciation', group: 'Language', desc: 'Phonemic transcription and spelling resources.' },
    { slug: 'false-friends', title: 'False Friends', href: 'section.html?section=false-friends', group: 'Language', desc: 'German–English false friends and practice files.' },
    { slug: 'writing-1', title: 'Writing 1', href: 'section.html?section=writing-1', group: 'Skills', desc: 'Writing practice, linking words and annotation support.' },
    { slug: 'writing-2', title: 'Writing 2', href: 'section.html?section=writing-2', group: 'Skills', desc: 'Second writing course archive.', available: false },
    { slug: 'reading-listening', title: 'Reading & Listening', href: 'section.html?section=reading-listening', group: 'Skills', desc: 'Reading texts, listening practice and answer sheets.' },
    { slug: 'spelling-punctuation', title: 'Spelling & Punctuation', href: 'section.html?section=spelling-punctuation', group: 'Language', desc: 'Punctuation and spelling worksheets.' },
    { slug: 'emails', title: 'Emails', href: 'section.html?section=emails', group: 'Business', desc: 'Formal letters, email structure and stock phrases.' },
    { slug: 'games', title: 'Games', href: 'section.html?section=games', group: 'Practice', desc: 'Jeopardy, crosswords, hangman and classroom games.' },
    { slug: 'videos', title: 'Videos', href: 'section.html?section=videos', group: 'Skills', desc: 'Video and listening activities from trusted providers.' },
    { slug: 'tests', title: 'Tests', href: 'section.html?section=tests', group: 'Practice', desc: 'Business English tests and quiz resources.', available: false },
    { slug: 'attendance', title: 'Attendance', href: 'section.html?section=attendance', group: 'Course', desc: 'Course attendance area.', available: false },
    { slug: 'vocabulary', title: 'Vocabulary', href: 'section.html?section=vocabulary', group: 'Language', desc: 'Telephone, travel, news and everyday vocabulary.' },
    { slug: 'finance', title: 'Finance', href: 'section.html?section=finance', group: 'Business', desc: 'Money, finance and business vocabulary.' }
  ],
  topics: [
    { title: 'Grammar', text: 'Tenses, conditionals and useful sentence patterns.', href: 'grammar.html', mark: '01' },
    { title: 'Medical English', text: 'Healthcare vocabulary and professional communication.', href: 'medical-english.html', mark: '02' },
    { title: 'Speaking', text: 'Discussion prompts, role plays and telephone language.', href: 'speaking.html', mark: '03' },
    { title: 'All 14 material sections', text: 'A clear, complete directory of every section with local materials.', href: 'library.html#section-directory', mark: '04' }
  ],
  resources: [
    { title: 'Business letters — sentences', type: 'PDF worksheet', topic: 'writing', section: 'home', href: 'assets/materials/business-letter-writing-sentence-exercise.pdf', desc: 'Useful sentence starters for formal business communication.', accent: true },
    { title: 'Presentations without PPT', type: 'DOC activity', topic: 'speaking', section: 'home', href: 'assets/materials/presentation-evaluation-sheet-without-ppt.doc', desc: 'Plan a short, confident presentation without slides.', accent: true },
    { title: 'Email mistakes 1', type: 'PDF worksheet', topic: 'writing', section: 'home', href: 'assets/materials/vhs-business-course-emails-common-mistakes-part-i.pdf', desc: 'Spot and fix common errors in professional emails.', accent: true },
    { title: 'Email mistakes 2', type: 'PDF worksheet', topic: 'writing', section: 'home', href: 'assets/materials/common-mistakes-in-emails-part-ii.pdf', desc: 'Continue correcting common email errors.', accent: true },
    { title: 'Business collocations', type: 'PDF guide', topic: 'vocabulary', section: 'home', href: 'assets/materials/business-collocations.pdf', desc: 'Natural word partnerships for professional English.', accent: false },
    { title: 'Using a dictionary', type: 'PDF guide', topic: 'vocabulary', section: 'home', href: 'assets/materials/using-a-dictionary.pdf', desc: 'Find meanings and collocations more effectively.', accent: false },
    { title: 'Number & frequency', type: 'PDF practice', topic: 'grammar', section: 'home', href: 'assets/materials/number-frequency.pdf', desc: 'Describe figures, trends and frequency accurately.', accent: true },

    { title: '1st type conditionals', type: 'PDF worksheet', topic: 'grammar', section: 'grammar', href: 'assets/materials/first-type-conditional-exercise.pdf', desc: 'Use real future possibilities with if and will.', accent: true },
    { title: '1st & 2nd type conditionals', type: 'PDF rules', topic: 'grammar', section: 'grammar', href: 'assets/materials/first-and-second-conditionals-rules.pdf', desc: 'Compare real and unreal conditional patterns.', accent: false },
    { title: 'Phrasal verbs in context', type: 'PDF guide', topic: 'grammar', section: 'grammar', href: 'assets/materials/phrasal-verbs-in-context-one.pdf', desc: 'Understand common phrasal verbs in everyday situations.', accent: false },
    { title: 'Present perfect & past simple', type: 'PDF rules', topic: 'grammar', section: 'grammar', href: 'assets/materials/present-perfect-past-simple-rules.pdf', desc: 'Choose the right tense for past time and experience.', accent: true },
    { title: 'Present simple & continuous', type: 'PDF worksheet', topic: 'grammar', section: 'grammar', href: 'assets/materials/pres-simple-or-continuous-1.pdf', desc: 'Practise routines, habits and actions happening now.', accent: true },
    { title: 'Linkers I', type: 'PDF worksheet', topic: 'grammar', section: 'grammar', href: 'assets/materials/linking-words-phrases.pdf', desc: 'Connect ideas with contrast, result and addition.', accent: false },
    { title: 'Relative clauses', type: 'PDF worksheet', topic: 'grammar', section: 'grammar', href: 'assets/materials/relative-clauses-rules-exercises.pdf', desc: 'Join ideas smoothly with who, which, that and where.', accent: true },

    { title: 'Healthcare services', type: 'PDF vocabulary', topic: 'medical', section: 'medical', href: 'assets/materials/healthcare-services.pdf', desc: 'Essential words for appointments, care and treatment.', accent: true },
    { title: 'Word families', type: 'PDF practice', topic: 'medical', section: 'medical', href: 'assets/materials/word-families.pdf', desc: 'Extend medical vocabulary through related word forms.', accent: true },
    { title: 'Health issues', type: 'PDF vocabulary', topic: 'medical', section: 'medical', href: 'assets/materials/health-issues.pdf', desc: 'Talk about symptoms, conditions and feeling unwell.', accent: true },
    { title: 'Medical advances', type: 'PDF reading', topic: 'medical', section: 'medical', href: 'assets/materials/i-can-describe-medical-advances.pdf', desc: 'Discuss innovations in health and how they affect patients.', accent: true },
    { title: 'Malaria', type: 'PDF reading', topic: 'medical', section: 'medical', href: 'assets/materials/malaria.pdf', desc: 'Read and discuss a major global health issue.', accent: false },
    { title: 'Health & illness', type: 'PDF worksheet', topic: 'medical', section: 'medical', href: 'assets/materials/francesco-health-illness.pdf', desc: 'Use health vocabulary in useful everyday contexts.', accent: false },
    { title: 'Line graph & bar graph', type: 'PDF practice', topic: 'medical', section: 'medical', href: 'assets/materials/line-graph-bar-graph.pdf', desc: 'Describe health-related data and charts clearly.', accent: false },
    { title: 'Interpreting graphs', type: 'PDF worksheet', topic: 'medical', section: 'medical', href: 'assets/materials/interpreting-graphs-questions.pdf', desc: 'Read graphs and support your answers with evidence.', accent: false },

    { title: 'Discussion topics', type: 'PDF worksheet', topic: 'speaking', section: 'speaking', href: 'assets/materials/28-discussion-topics.pdf', desc: 'Conversation starters for pairs and groups.', accent: true },
    { title: 'Arranging a meeting I', type: 'PDF role play', topic: 'speaking', section: 'speaking', href: 'assets/materials/cold-calls-arranging-a-meeting-part-one.pdf', desc: 'Make suggestions and agree a suitable time.', accent: true },
    { title: 'Arranging a meeting II', type: 'PDF role play', topic: 'speaking', section: 'speaking', href: 'assets/materials/cold-calls-arranging-a-meeting-part-two.pdf', desc: 'Continue a professional telephone conversation.', accent: true },
    { title: 'Confirming information', type: 'PDF dialogue', topic: 'speaking', section: 'speaking', href: 'assets/materials/telephone-dialogues-confirming-information.pdf', desc: 'Check and repeat important information politely.', accent: false },
    { title: 'Buying time', type: 'PDF dialogue', topic: 'speaking', section: 'speaking', href: 'assets/materials/telephone-dialogues-buying-time.pdf', desc: 'Keep a call moving while you check details.', accent: false },
    { title: 'Uses of objects', type: 'PDF discussion', topic: 'speaking', section: 'speaking', href: 'assets/materials/uses-of-everyday-objects.pdf', desc: 'Explain practical solutions with everyday vocabulary.', accent: false },
    { title: 'Business idioms I', type: 'PDF worksheet', topic: 'speaking', section: 'speaking', href: 'assets/materials/business-idioms-one.pdf', desc: 'Learn idioms you may hear in business contexts.', accent: false },
    { title: 'The Green Revolution', type: 'PDF reading', topic: 'speaking', section: 'speaking', href: 'assets/materials/vocab-for-ielts-u15-the-green-revolution.pdf', desc: 'Discuss sustainability and environmental change.', accent: true }
  ]
};
