import React, { useState } from 'react';
import {
  Search,
  Book,
  ExternalLink,
  RefreshCw,
  Library,
  Copy,
  Check,
  Bookmark,
  Save,
} from 'lucide-react';
import { searchOpenLibrary, OpenLibraryBook } from '../../services/publicApis';
import { t, useLang } from '../../services/i18n';

export const OpenLibraryWorkspace: React.FC = () => {
  useLang();
  const [query, setQuery] = useState(() => {
    try { const p = localStorage.getItem('scc_openlib_prefill_v1'); if (p) { localStorage.removeItem('scc_openlib_prefill_v1'); return p; } } catch {}
    return '';
  });
  const [books, setBooks] = useState<OpenLibraryBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNoteKey, setSavedNoteKey] = useState<string | null>(null);

  // Auto-search if prefilled from Assignment Tracker
  React.useEffect(() => {
    if (query.trim()) {
      (async () => {
        setIsLoading(true);
        setError(null);
        try { const results = await searchOpenLibrary(query); setBooks(results); } catch (err) { console.error('Open Library search failed:', err); setError('Search failed. Check your connection and try again.'); } finally { setIsLoading(false); }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchOpenLibrary(query);
      setBooks(results);
    } catch (err) {
      console.error('Open Library search failed:', err);
      setError('Search failed. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyIsbn = (book: OpenLibraryBook) => {
    if (book.isbn && book.isbn.length > 0) {
      navigator.clipboard.writeText(book.isbn[0]);
      setCopiedKey(book.key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };
  const handleSaveToNotes = (book: OpenLibraryBook) => {
    try {
      const raw = localStorage.getItem('scc_markdown_notes_v1');
      const notes = raw ? JSON.parse(raw) : [];
      const authors = book.authorNames.join(', ') || 'Unknown Author';
      const year = String(book.firstPublishYear || '');
      const citeKey = `book${book.key.replace(/[^a-zA-Z0-9]/g, '')}${year || 'nd'}`;
      const bibtex = `@book{${citeKey},\n  title = {${book.title}},\n  author = {${authors}},${year ? `\n  year = {${year}},` : ''}\n  url = {${book.openLibraryUrl}}\n}`;
      const isbnLine = book.isbn && book.isbn.length > 0 ? `\n**ISBN:** ${book.isbn[0]}` : '';
      const yearLine = year ? `\n**First Published:** ${year}` : '';
      const content = `# ${book.title}\n\n**Authors:** ${authors}${yearLine}${isbnLine}\n**Open Library:** ${book.openLibraryUrl}\n\n## Citation (BibTeX)\n\`\`\`bibtex\n${bibtex}\n\`\`\`\n`;
      const newNote = {
        id: `note-${Date.now()}`,
        title: `Book: ${book.title.slice(0, 60)}`,
        subject: 'Reading List',
        content,
        updatedAt: new Date().toLocaleDateString(),
      };
      localStorage.setItem('scc_markdown_notes_v1', JSON.stringify([newNote, ...notes]));
      setSavedNoteKey(book.key);
      setTimeout(() => setSavedNoteKey(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FAF9F5] dark:bg-[#141413] p-4 sm:p-6 space-y-5 animate-in fade-in select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
              {t('lib_title')}
            </h2>
            <p className="text-xs text-[#8C897F]">
              {t('lib_sub')}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('lib_search_ph')}
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757] w-72"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t('lib_find')}</span>
          </button>
        </form>
      </div>

      {/* Main Results Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-24 text-center text-[#8C897F] text-xs space-y-2">
            <RefreshCw className="w-7 h-7 text-[#D97757] animate-spin mx-auto opacity-70" />
            <p>{t('lib_loading')}</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-xs space-y-3">
            <p className="font-bold text-[#141413] dark:text-[#FAF9F5]">{error}</p>
            <p className="text-[#8C897F]">Your search for “{query}” was kept — retry when ready.</p>
            <button onClick={() => handleSearch()} className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
              Retry
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center text-[#8C897F] text-xs space-y-3">
            <Book className="w-10 h-10 mx-auto opacity-30" />
            <div className="space-y-1">
              <p className="font-bold text-[#141413] dark:text-[#FAF9F5]">{t('lib_empty_t')}</p>
              <p>Try: "Campbell Biology", "Stewart Calculus", "Introduction to Algorithms", "Pride and Prejudice"</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-[#8C897F] px-1">{books.length} results</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {books.map((book) => (
              <div
                key={book.key}
                className="bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-4 flex flex-col justify-between space-y-3 shadow-xs hover:border-[#D97757] transition-all"
              >
                <div className="space-y-2.5">
                  {/* Cover image or placeholder */}
                  <div className="h-40 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-xl flex items-center justify-center overflow-hidden border border-[#DFDACB]/40 dark:border-[#2C2B27]/40">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    ) : (
                      <Book className="w-8 h-8 text-[#8C897F] opacity-40" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] leading-snug line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-[11px] text-[#8C897F] truncate">
                      {book.authorNames.join(', ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-[#8C897F]">
                    {book.firstPublishYear && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27]">
                        {book.firstPublishYear}
                      </span>
                    )}
                    {book.editionCount && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27]">
                        {book.editionCount} {t('lib_editions')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                  {book.isbn && book.isbn.length > 0 ? (
                    <button
                      onClick={() => handleCopyIsbn(book)}
                      className="px-2 py-1 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                      title={t('lib_copy_isbn')}
                    >
                      {copiedKey === book.key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{book.isbn[0]}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#8C897F]">{t('lib_open_catalog')}</span>
                  )}

                  <a
                    href={book.openLibraryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-[#D97757] hover:bg-[#C86646] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <span>{t('lib_read_borrow')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  </div>
                  <button
                    onClick={() => handleSaveToNotes(book)}
                    className="w-full py-1 text-[11px] font-bold bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg flex items-center justify-center gap-1 hover:border-violet-400 cursor-pointer"
                  >
                    {savedNoteKey === book.key ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Saved to Notes</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 text-violet-600" />
                        <span>Save to Notes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

    </div>
  );
};
