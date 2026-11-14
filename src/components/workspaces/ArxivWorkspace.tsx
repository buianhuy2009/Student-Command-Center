import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  FileText,
  ExternalLink,
  Download,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Save,
} from 'lucide-react';
import { searchArxiv, ArxivPaper } from '../../services/publicApis';
import { t, useLang } from '../../services/i18n';

const CATEGORIES = [
  { id: 'all', key: 'arxiv_cat_all' },
  { id: 'cs.AI', key: 'arxiv_cat_cs' },
  { id: 'math', key: 'arxiv_cat_math' },
  { id: 'physics', key: 'arxiv_cat_phys' },
  { id: 'q-bio', key: 'arxiv_cat_bio' },
  { id: 'econ', key: 'arxiv_cat_econ' },
  { id: 'stat', key: 'arxiv_cat_stat' },
];

export const ArxivWorkspace: React.FC = () => {
  useLang();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<ArxivPaper | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    handleSearch();
  }, [category]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchArxiv(query, category);
      setPapers(results);
      if (results.length > 0) {
        setSelectedPaper(results[0]);
      }
    } catch (err) {
      console.error('arXiv search failed:', err);
      setError('Search failed. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCitation = (paper: ArxivPaper) => {
    const citation = `${paper.authors.join(', ')} (${paper.published.slice(-4) || '2026'}). "${paper.title}". arXiv preprint ${paper.id}.`;
    navigator.clipboard.writeText(citation);
    setCopiedId(paper.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [savedToNotesId, setSavedToNotesId] = useState<string | null>(null);
  const handleSaveToNotes = (paper: ArxivPaper) => {
    try {
      const raw = localStorage.getItem('scc_markdown_notes_v1');
      const notes = raw ? JSON.parse(raw) : [];
      const authors = paper.authors.join(', ');
      const year = paper.published.slice(0, 4) || '2025';
      const citeKey = `arxiv${year}${paper.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`;
      const bibtex = `@article{${citeKey},\n  title = {${paper.title}},\n  author = {${authors}},\n  year = {${year}},\n  url = {${paper.pdfUrl}}\n}`;
      const content = `# ${paper.title}\n\n**Authors:** ${authors}\n**Category:** ${paper.primaryCategory} • **Published:** ${paper.published}\n**arXiv:** ${paper.arxivUrl}\n**PDF:** ${paper.pdfUrl}\n\n## Abstract\n${paper.summary}\n\n## Citation (BibTeX)\n\`\`\`bibtex\n${bibtex}\n\`\`\`\n`;
      const newNote = { id: `note-${Date.now()}`, title: `arXiv: ${paper.title.slice(0, 60)}`, subject: paper.primaryCategory || 'Research', content, updatedAt: new Date().toLocaleDateString() };
      localStorage.setItem('scc_markdown_notes_v1', JSON.stringify([newNote, ...notes]));
      setSavedToNotesId(paper.id);
      setTimeout(() => setSavedToNotesId(null), 2000);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FAF9F5] dark:bg-[#141413] p-4 sm:p-6 space-y-5 animate-in fade-in select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
              {t('arxiv_title')}
            </h2>
            <p className="text-xs text-[#8C897F]">
              {t('arxiv_sub')}
            </p>
          </div>
        </div>

        {/* Search Bar & Category */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('arxiv_search_ph')}
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757] w-64"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] focus:outline-none cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {t(cat.key)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t('search')}</span>
          </button>
        </form>
      </div>

      {/* Main Grid: Papers List + Detail Abstract */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left: Paper Cards List */}
        <div className="lg:col-span-6 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <div className="py-20 text-center text-[#8C897F] text-xs space-y-2">
              <RefreshCw className="w-7 h-7 text-[#D97757] animate-spin mx-auto opacity-70" />
              <p>{t('arxiv_loading')}</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-xs space-y-3">
              <p className="font-bold text-[#141413] dark:text-[#FAF9F5]">{error}</p>
              <p className="text-[#8C897F]">Your search for “{query}” was kept — retry when ready.</p>
              <button onClick={() => handleSearch()} className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                Retry
              </button>
            </div>
          ) : papers.length === 0 ? (
            <div className="py-20 text-center text-[#8C897F] text-xs space-y-2">
              <BookOpen className="w-8 h-8 mx-auto opacity-30" />
              <p>{t('arxiv_empty')}</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-[#8C897F] px-1">{papers.length} results</p>
            {papers.map((paper) => {
              const isSelected = selectedPaper?.id === paper.id;
              return (
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaper(paper)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-white dark:bg-[#1A1917] border-[#D97757] shadow-xs'
                      : 'bg-white/60 dark:bg-[#1A1917]/60 border-[#DFDACB] dark:border-[#2C2B27] hover:bg-white dark:hover:bg-[#1A1917]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#8C897F]">
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] font-mono font-bold text-[#D97757]">
                      {paper.primaryCategory}
                    </span>
                    <span>{paper.published}</span>
                  </div>

                  <h3 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] leading-snug line-clamp-2">
                    {paper.title}
                  </h3>

                  <div className="text-[11px] text-[#8C897F] truncate">
                    {paper.authors.join(', ')}
                  </div>
                </div>
              );
            })}
            </>
          )}
        </div>

        {/* Right: Selected Paper Abstract & PDF Viewer Trigger */}
        <div className="lg:col-span-6 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs flex flex-col justify-between overflow-y-auto">
          {selectedPaper ? (
            <div className="space-y-5">
              <div className="space-y-2 pb-4 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#D97757]">
                    {selectedPaper.primaryCategory}
                  </span>
                  <span className="text-[11px] text-[#8C897F]">
                    {t('arxiv_published')} {selectedPaper.published}
                  </span>
                </div>

                <h2 className="text-sm font-extrabold text-[#141413] dark:text-[#FAF9F5] leading-snug">
                  {selectedPaper.title}
                </h2>

                <p className="text-xs text-[#8C897F]">
                  <span className="font-semibold text-[#141413] dark:text-[#FAF9F5]">{t('arxiv_authors')} </span>
                  {selectedPaper.authors.join(', ')}
                </p>
              </div>

              {/* Abstract */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F] block">
                  {t('arxiv_abstract')}
                </span>
                <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-xs text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed max-h-72 overflow-y-auto">
                  {selectedPaper.summary}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => handleCopyCitation(selectedPaper)}
                  className="px-3 py-2 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedId === selectedPaper.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === selectedPaper.id ? t('arxiv_copied') : t('arxiv_copy')}</span>
                </button>

                <button
                  onClick={() => handleSaveToNotes(selectedPaper)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${savedToNotesId === selectedPaper.id ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white dark:bg-[#252422] border-[#DFDACB] dark:border-[#2C2B27] hover:border-violet-500 text-[#141413] dark:text-[#FAF9F5]'}`}
                >
                  {savedToNotesId === selectedPaper.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5 text-violet-600" />}
                  <span>{savedToNotesId === selectedPaper.id ? t('arxiv_saved') : t('arxiv_save')}</span>
                </button>

                <a
                  href={selectedPaper.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('arxiv_open_pdf')}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                </a>
              </div>
            </div>
          ) : (
            <div className="my-auto text-center text-[#8C897F] text-xs py-16 space-y-2">
              <BookOpen className="w-10 h-10 mx-auto opacity-30" />
              <p>{t('arxiv_select_hint')}</p>
            </div>
          )}

          <div className="pt-4 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-[10px] text-[#8C897F] flex items-center justify-between">
            <span>{t('arxiv_footer_a')}</span>
            <span className="font-mono">{t('arxiv_footer_b')}</span>
          </div>
        </div>

      </div>

    </div>
  );
};
