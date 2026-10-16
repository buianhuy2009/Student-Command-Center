import React, { useState, useMemo } from 'react';
import {
  Calculator,
  ArrowRightLeft,
  Sparkles,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Equal,
} from 'lucide-react';

type UnitCategory = 'length' | 'mass' | 'temperature' | 'speed' | 'storage' | 'energy' | 'pressure';

interface UnitDefinition {
  id: string;
  name: string;
  factor: number; // relative to base unit (or custom conversion for temperature)
  symbol: string;
}

const UNIT_CATEGORIES: Record<
  UnitCategory,
  {
    name: string;
    baseUnit: string;
    units: UnitDefinition[];
  }
> = {
  length: {
    name: 'Length & Distance',
    baseUnit: 'm',
    units: [
      { id: 'm', name: 'Meters', factor: 1, symbol: 'm' },
      { id: 'km', name: 'Kilometers', factor: 1000, symbol: 'km' },
      { id: 'cm', name: 'Centimeters', factor: 0.01, symbol: 'cm' },
      { id: 'mm', name: 'Millimeters', factor: 0.001, symbol: 'mm' },
      { id: 'in', name: 'Inches', factor: 0.0254, symbol: 'in' },
      { id: 'ft', name: 'Feet', factor: 0.3048, symbol: 'ft' },
      { id: 'yd', name: 'Yards', factor: 0.9144, symbol: 'yd' },
      { id: 'mi', name: 'Miles', factor: 1609.344, symbol: 'mi' },
    ],
  },
  mass: {
    name: 'Mass & Weight',
    baseUnit: 'kg',
    units: [
      { id: 'kg', name: 'Kilograms', factor: 1, symbol: 'kg' },
      { id: 'g', name: 'Grams', factor: 0.001, symbol: 'g' },
      { id: 'mg', name: 'Milligrams', factor: 0.000001, symbol: 'mg' },
      { id: 'lb', name: 'Pounds', factor: 0.45359237, symbol: 'lb' },
      { id: 'oz', name: 'Ounces', factor: 0.028349523125, symbol: 'oz' },
      { id: 'ton', name: 'Metric Tons', factor: 1000, symbol: 't' },
    ],
  },
  temperature: {
    name: 'Temperature',
    baseUnit: 'C',
    units: [
      { id: 'C', name: 'Celsius', factor: 1, symbol: '°C' },
      { id: 'F', name: 'Fahrenheit', factor: 1, symbol: '°F' },
      { id: 'K', name: 'Kelvin', factor: 1, symbol: 'K' },
    ],
  },
  speed: {
    name: 'Speed & Velocity',
    baseUnit: 'm/s',
    units: [
      { id: 'm/s', name: 'Meters / Second', factor: 1, symbol: 'm/s' },
      { id: 'km/h', name: 'Kilometers / Hour', factor: 0.277777778, symbol: 'km/h' },
      { id: 'mph', name: 'Miles / Hour', factor: 0.44704, symbol: 'mph' },
      { id: 'knot', name: 'Knots', factor: 0.514444, symbol: 'kn' },
    ],
  },
  storage: {
    name: 'Digital Data & Memory',
    baseUnit: 'B',
    units: [
      { id: 'B', name: 'Bytes', factor: 1, symbol: 'B' },
      { id: 'KB', name: 'Kilobytes (KB)', factor: 1024, symbol: 'KB' },
      { id: 'MB', name: 'Megabytes (MB)', factor: 1024 * 1024, symbol: 'MB' },
      { id: 'GB', name: 'Gigabytes (GB)', factor: 1024 * 1024 * 1024, symbol: 'GB' },
      { id: 'TB', name: 'Terabytes (TB)', factor: 1024 * 1024 * 1024 * 1024, symbol: 'TB' },
    ],
  },
  energy: {
    name: 'Energy & Work',
    baseUnit: 'J',
    units: [
      { id: 'J', name: 'Joules', factor: 1, symbol: 'J' },
      { id: 'kJ', name: 'Kilojoules', factor: 1000, symbol: 'kJ' },
      { id: 'cal', name: 'Calories', factor: 4.184, symbol: 'cal' },
      { id: 'kcal', name: 'Kilocalories', factor: 4184, symbol: 'kcal' },
      { id: 'Wh', name: 'Watt-hours', factor: 3600, symbol: 'Wh' },
      { id: 'kWh', name: 'Kilowatt-hours', factor: 3600000, symbol: 'kWh' },
      { id: 'eV', name: 'Electronvolts', factor: 1.602176634e-19, symbol: 'eV' },
    ],
  },
  pressure: {
    name: 'Pressure & Atmosphere',
    baseUnit: 'Pa',
    units: [
      { id: 'Pa', name: 'Pascals', factor: 1, symbol: 'Pa' },
      { id: 'kPa', name: 'Kilopascals', factor: 1000, symbol: 'kPa' },
      { id: 'bar', name: 'Bar', factor: 100000, symbol: 'bar' },
      { id: 'atm', name: 'Standard Atmospheres', factor: 101325, symbol: 'atm' },
      { id: 'psi', name: 'Pounds / Sq Inch (PSI)', factor: 6894.76, symbol: 'psi' },
      { id: 'torr', name: 'Torr (mmHg)', factor: 133.322, symbol: 'Torr' },
    ],
  },
};

export const UnitConverterWorkspace: React.FC = () => {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [fromUnitId, setFromUnitId] = useState<string>('m');
  const [toUnitId, setToUnitId] = useState<string>('ft');
  const [fromValue, setFromValue] = useState<string>('1');
  const [copied, setCopied] = useState(false);

  // Scientific quick calculator
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const currentCategoryData = UNIT_CATEGORIES[category];

  // Keep fromUnit & toUnit valid when category changes
  const handleCategoryChange = (newCat: UnitCategory) => {
    setCategory(newCat);
    const catData = UNIT_CATEGORIES[newCat];
    setFromUnitId(catData.units[0].id);
    setToUnitId(catData.units[1]?.id || catData.units[0].id);
  };

  const handleSwapUnits = () => {
    const temp = fromUnitId;
    setFromUnitId(toUnitId);
    setToUnitId(temp);
  };

  const convertedValue = useMemo(() => {
    const num = parseFloat(fromValue);
    if (isNaN(num)) return '';

    if (category === 'temperature') {
      let celsius = num;
      if (fromUnitId === 'F') celsius = ((num - 32) * 5) / 9;
      else if (fromUnitId === 'K') celsius = num - 273.15;

      let result = celsius;
      if (toUnitId === 'F') result = (celsius * 9) / 5 + 32;
      else if (toUnitId === 'K') result = celsius + 273.15;

      return Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');
    }

    const fromUnit = currentCategoryData.units.find((u) => u.id === fromUnitId);
    const toUnit = currentCategoryData.units.find((u) => u.id === toUnitId);
    if (!fromUnit || !toUnit) return '';

    const inBase = num * fromUnit.factor;
    const result = inBase / toUnit.factor;

    return Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '');
  }, [fromValue, fromUnitId, toUnitId, category, currentCategoryData]);

  const handleCopyResult = () => {
    if (!convertedValue) return;
    navigator.clipboard.writeText(`${fromValue} ${fromUnitId} = ${convertedValue} ${toUnitId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Instant Math Evaluator: tokenizer + recursive-descent parser (no eval/Function) ---
  // Supports +-*/^% parentheses, decimals, implicit-mult like 2(3+4) / 2pi,
  // functions sqrt/sin/cos/tan/log(base-10)/ln, constants pi/e.
  // Precedence: parens/functions > ^ (right-assoc) > unary > implicit/explicit */% > +-.
  type MathToken =
    | { kind: 'num'; value: number; pos: number; raw: string }
    | { kind: 'op'; op: string; pos: number }
    | { kind: 'lparen'; pos: number }
    | { kind: 'rparen'; pos: number }
    | { kind: 'ident'; name: string; pos: number };

  const tokenizeMath = (input: string): MathToken[] => {
    const tokens: MathToken[] = [];
    let i = 0;
    while (i < input.length) {
      const ch = input[i];
      const pos = i;
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      if (ch === '(') {
        tokens.push({ kind: 'lparen', pos });
        i += 1;
        continue;
      }
      if (ch === ')') {
        tokens.push({ kind: 'rparen', pos });
        i += 1;
        continue;
      }
      if ('+-*/^%'.includes(ch)) {
        tokens.push({ kind: 'op', op: ch, pos });
        i += 1;
        continue;
      }
      if (ch === ',') {
        throw new Error(`Unexpected ',' at position ${pos} — functions take a single argument, e.g. sqrt(16)`);
      }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < input.length && /[0-9.]/.test(input[j])) j += 1;
        let raw = input.slice(i, j);
        // Scientific notation: 1e3 / 1E-3 / 2.5e+4 (keeps 'e' constant unambiguous)
        const sci = /^([0-9]*\.?[0-9]+)[eE]([+-]?[0-9]+)$/.exec(input.slice(i, j + 6));
        if (sci) {
          raw = sci[0];
          j = i + raw.length;
        }
        if (!/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || raw === '.') {
          throw new Error(`Invalid number '${raw}' at position ${pos}`);
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(`Invalid number '${raw}' at position ${pos}`);
        }
        tokens.push({ kind: 'num', value, pos, raw });
        i = j;
        continue;
      }
      if (/[a-zA-Zπ]/.test(ch)) {
        let j = i;
        while (j < input.length && /[a-zA-Zπ]/.test(input[j])) j += 1;
        const name = input.slice(i, j).toLowerCase();
        tokens.push({ kind: 'ident', name, pos });
        i = j;
        continue;
      }
      throw new Error(`Unexpected character '${ch}' at position ${pos}`);
    }
    return tokens;
  };

  const evaluateMathExpression = (input: string): number => {
    const tokens = tokenizeMath(input);
    if (tokens.length === 0) throw new Error('Empty expression at position 0 — try e.g. 2+2*3');
    let idx = 0;
    const peek = () => tokens[idx];
    const SUPPORTED_FUNCS = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln'];

    const parseExpression = (): number => {
      let left = parseTerm();
      for (;;) {
        const t = peek();
        if (t && t.kind === 'op' && (t.op === '+' || t.op === '-')) {
          idx += 1;
          const next = peek();
          if (!next) throw new Error(`Unexpected end of expression at position ${input.length} — expected a number or '(' after '${t.op}'`);
          if (next.kind === 'op' && (next.op === '*' || next.op === '/' || next.op === '^' || next.op === '%' || next.op === ')')) {
            throw new Error(`Unexpected '${(next.kind === 'op' ? next.op : ')')}' at position ${next.pos} — expected a number or '(' after '${t.op}'`);
          }
          if (next.kind === 'rparen') throw new Error(`Unexpected ')' at position ${next.pos} — expected a value after '${t.op}'`);
          const right = parseTerm();
          left = t.op === '+' ? left + right : left - right;
        } else break;
      }
      return left;
    };

    const isImplicitStart = (t: MathToken | undefined): boolean =>
      !!t && (t.kind === 'num' || t.kind === 'lparen' || t.kind === 'ident');

    const parseTerm = (): number => {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (t && t.kind === 'op' && (t.op === '*' || t.op === '/' || t.op === '%')) {
          const opPos = t.pos;
          idx += 1;
          const next = peek();
          if (!next) throw new Error(`Unexpected end of expression at position ${input.length} — expected a value after '${t.op}'`);
          if (next.kind === 'rparen') throw new Error(`Unexpected ')' at position ${next.pos} — expected a value after '${t.op}'`);
          if (next.kind === 'op') throw new Error(`Unexpected '${next.op}' at position ${next.pos} — expected a value after '${t.op}'`);
          const right = parseUnary();
          if (t.op === '*') left = left * right;
          else if (t.op === '/') {
            if (right === 0) throw new Error(`Division by zero at position ${opPos}`);
            left = left / right;
          } else {
            if (right === 0) throw new Error(`Modulo by zero at position ${opPos}`);
            left = left % right;
          }
        } else if (isImplicitStart(t)) {
          // Implicit multiplication: 2(3+4), (2+3)(4+5), 2pi, 2sqrt(4)
          const right = parseUnary();
          left = left * right;
        } else break;
      }
      return left;
    };

    const parseUnary = (): number => {
      const t = peek();
      if (t && t.kind === 'op' && (t.op === '+' || t.op === '-')) {
        idx += 1;
        const operand = parseUnary();
        return t.op === '+' ? operand : -operand;
      }
      return parsePower();
    };

    const parsePower = (): number => {
      const base = parsePrimary();
      const t = peek();
      if (t && t.kind === 'op' && t.op === '^') {
        const opPos = t.pos;
        idx += 1;
        const next = peek();
        if (!next) throw new Error(`Unexpected end of expression at position ${input.length} — expected an exponent after '^'`);
        if (next.kind === 'rparen') throw new Error(`Unexpected ')' at position ${next.pos} — expected an exponent after '^'`);
        if (next.kind === 'op' && (next.op === '*' || next.op === '/' || next.op === '^' || next.op === '%' || next.op === ')')) {
          throw new Error(`Unexpected '${next.op}' at position ${next.pos} — expected an exponent after '^' (hint: use 2^${next.op === '^' ? '3' : '2'}) at position ${opPos}`);
        }
        const exponent = parseUnary(); // allows 2^-3 and right-assoc 2^3^2
        const result = Math.pow(base, exponent);
        if (!Number.isFinite(result)) throw new Error(`Result is not finite at position ${opPos} (overflow, e.g. 0^negative or huge exponent)`);
        return result;
      }
      return base;
    };

    const parsePrimary = (): number => {
      const t = peek();
      if (!t) throw new Error(`Unexpected end of expression at position ${input.length} — expected a number, function, or '('`);
      if (t.kind === 'num') {
        idx += 1;
        return t.value;
      }
      if (t.kind === 'ident') {
        const name = t.name;
        const namePos = t.pos;
        if (name === 'pi' || name === 'π') {
          idx += 1;
          return Math.PI;
        }
        if (name === 'e') {
          idx += 1;
          return Math.E;
        }
        if (SUPPORTED_FUNCS.includes(name)) {
          idx += 1;
          const open = peek();
          if (!open || open.kind !== 'lparen') {
            throw new Error(`Expected '(' after '${name}' at position ${namePos} — try ${name}(…)`);
          }
          idx += 1; // consume '('
          const arg = parseExpression();
          const close = peek();
          if (!close) throw new Error(`Missing closing ')' for '${name}(' opened at position ${open.pos}`);
          if (close.kind !== 'rparen') throw new Error(`Unexpected '${close.kind === 'op' ? close.op : close.kind}' at position ${close.pos} — expected ')' to close '${name}('`);
          idx += 1;
          if (name === 'sqrt') {
            if (arg < 0) throw new Error(`sqrt() domain error at position ${namePos}: negative input ${arg}`);
            return Math.sqrt(arg);
          }
          if (name === 'sin') return Math.sin(arg);
          if (name === 'cos') return Math.cos(arg);
          if (name === 'tan') return Math.tan(arg);
          if (name === 'log') {
            if (arg <= 0) throw new Error(`log() domain error at position ${namePos}: input must be > 0 (base-10)`);
            return Math.log10(arg);
          }
          // ln
          if (arg <= 0) throw new Error(`ln() domain error at position ${namePos}: input must be > 0`);
          return Math.log(arg);
        }
        throw new Error(`Unknown function '${name}' at position ${namePos} (supported: sqrt, sin, cos, tan, log, ln; constants: pi, e)`);
      }
      if (t.kind === 'lparen') {
        const openPos = t.pos;
        idx += 1;
        // Empty parens "()" check
        if (peek() && peek()!.kind === 'rparen') {
          throw new Error(`Empty parentheses '()' at position ${openPos} — add a value inside`);
        }
        const value = parseExpression();
        const close = peek();
        if (!close) throw new Error(`Missing closing ')' for '(' opened at position ${openPos}`);
        if (close.kind !== 'rparen') throw new Error(`Unexpected '${close.kind === 'op' ? close.op : close.kind}' at position ${close.pos} — expected ')' to match '(' at position ${openPos}`);
        idx += 1;
        return value;
      }
      if (t.kind === 'rparen') throw new Error(`Unexpected ')' at position ${t.pos} — no matching '('`);
      throw new Error(`Unexpected '${t.op}' at position ${t.pos} — expected a number, function, or '('`);
    };

    const value = parseExpression();
    const leftover = peek();
    if (leftover) {
      if (leftover.kind === 'rparen') throw new Error(`Unexpected ')' at position ${leftover.pos} — no matching '('`);
      if (leftover.kind === 'op') throw new Error(`Unexpected '${leftover.op}' at position ${leftover.pos} — expected end of expression`);
      throw new Error(`Unexpected '${leftover.kind === 'ident' ? leftover.name : leftover.kind}' at position ${leftover.pos} — expected an operator (+-*/^%) or end`);
    }
    if (!Number.isFinite(value)) throw new Error('Result is not finite (overflow or invalid operation)');
    return value;
  };

  const formatMathResult = (n: number): string => {
    if (!Number.isFinite(n)) return 'Error: Result is not finite (overflow or invalid operation)';
    const snapped = Math.abs(n) < 1e-12 ? 0 : n;
    if (Number.isInteger(snapped)) return snapped.toString();
    return parseFloat(snapped.toPrecision(12)).toString();
  };

  const handleEvaluateExpression = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = calcInput.trim();
    if (!trimmed) {
      setCalcResult('Enter an expression, e.g. 2+2*3');
      return;
    }
    try {
      const value = evaluateMathExpression(trimmed);
      setCalcResult(formatMathResult(value));
    } catch (err: any) {
      setCalcResult(`Error: ${err?.message || 'invalid expression'}`);
    }
  };

  const getGeminiKeyInline = (): string => {
    try {
      return (
        sessionStorage.getItem('scc_gemini_api_key_session') ||
        localStorage.getItem('scc_gemini_api_key') ||
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        ''
      );
    } catch {
      return '';
    }
  };

  const handleAskAi = async () => {
    const trimmed = calcInput.trim();
    if (!trimmed) {
      setAiResult('Enter an expression first.');
      return;
    }
    const key = getGeminiKeyInline();
    if (!key) {
      setAiResult('No Gemini API key found. Add one in Settings → AI (BYOK) to use Ask AI.');
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const prompt =
        `Evaluate this math expression and explain briefly: ${trimmed}\n` +
        'Rules: ^ is exponent (right-associative), % is modulo, log() is base-10, ln() is natural log, trig in radians, pi ≈ 3.14159, e ≈ 2.71828. Support implicit multiplication like 2(3+4). ' +
        'Return the first line as "Result: <number>" then a 1-2 sentence explanation.';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
      const data = await res.json().catch(() => ({} as any));
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim();
      setAiResult(text || 'No answer returned from Gemini.');
    } catch (err: any) {
      setAiResult(`AI request failed: ${err?.message || 'unknown error'}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FAF9F5] dark:bg-[#141413] p-4 sm:p-6 space-y-6 animate-in fade-in select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
              Scientific Unit Converter &amp; Evaluator
            </h2>
            <p className="text-xs text-[#8C897F]">
              Instant two-way conversion for STEM courses, physics labs, and engineering units
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(UNIT_CATEGORIES) as UnitCategory[]).map((catKey) => (
            <button
              key={catKey}
              onClick={() => handleCategoryChange(catKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                category === catKey
                  ? 'bg-[#D97757] text-white shadow-2xs'
                  : 'bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5]'
              }`}
            >
              {UNIT_CATEGORIES[catKey].name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Converter & Expression Evaluator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto">
        
        {/* Left 7 cols: Interactive Converter */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF9F5]">
                {currentCategoryData.name}
              </h3>
              <button
                onClick={handleSwapUnits}
                className="p-1.5 rounded-xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F] hover:text-[#D97757] transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                title="Swap From and To units"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
            </div>

            {/* Input & Unit Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* From Unit */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#8C897F] uppercase tracking-wider block">
                  From
                </label>
                <input
                  type="number"
                  value={fromValue}
                  onChange={(e) => setFromValue(e.target.value)}
                  placeholder="Enter value..."
                  className="w-full px-4 py-3 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl text-base font-mono font-bold text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757]"
                />
                <select
                  value={fromUnitId}
                  onChange={(e) => setFromUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] focus:outline-none cursor-pointer"
                >
                  {currentCategoryData.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* To Unit */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#8C897F] uppercase tracking-wider block">
                  To (Result)
                </label>
                <div className="w-full px-4 py-3 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl text-base font-mono font-bold text-[#D97757] truncate flex items-center min-h-[50px]">
                  {convertedValue || '0'}
                </div>
                <select
                  value={toUnitId}
                  onChange={(e) => setToUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-xs font-semibold text-[#141413] dark:text-[#FAF9F5] focus:outline-none cursor-pointer"
                >
                  {currentCategoryData.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Quick Conversion Equation & Copy */}
            <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between gap-4">
              <div className="text-xs font-mono font-bold text-[#141413] dark:text-[#FAF9F5] truncate">
                {fromValue || '1'} {fromUnitId} = {convertedValue || '0'} {toUnitId}
              </div>
              <button
                onClick={handleCopyResult}
                className="px-3 py-1.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-xl text-xs font-bold text-[#8C897F] hover:text-[#D97757] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-[11px] text-[#8C897F] flex items-center justify-between">
            <span>High-precision IEEE-754 conversion</span>
            <span className="font-mono">Exact Ratios</span>
          </div>
        </div>

        {/* Right 5 cols: Fast Scientific Expression Evaluator */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1A1917] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#D97757]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#141413] dark:text-[#FAF9F5]">
                  Instant Math Evaluator
                </h3>
              </div>
              <span className="text-[10px] text-[#8C897F] font-mono">
                Supports sqrt, sin, cos, log, pi, ^, %
              </span>
            </div>

            <form onSubmit={handleEvaluateExpression} className="space-y-3">
              <input
                type="text"
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
                placeholder="e.g. sqrt(144) + 2 * pi * 5"
                className="w-full px-4 py-3 bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl text-xs font-mono text-[#141413] dark:text-[#FAF9F5] focus:outline-none focus:border-[#D97757]"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Equal className="w-3.5 h-3.5" />
                  <span>Calculate Result</span>
                </button>
                <button
                  type="button"
                  onClick={handleAskAi}
                  disabled={aiLoading}
                  title="Explain / double-check with Gemini (needs API key)"
                  className="px-3.5 py-2.5 bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-xl text-xs font-bold text-[#8C897F] hover:text-[#D97757] transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiLoading ? 'Asking…' : 'Ask AI'}</span>
                </button>
              </div>
            </form>

            {calcResult !== null && (
              <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F]">
                  Computed Output
                </span>
                <div className="text-lg font-mono font-extrabold text-[#D97757]">
                  {calcResult}
                </div>
              </div>
            )}

            {aiResult !== null && (
              <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F]">
                  AI Explanation (Gemini)
                </span>
                <div className="text-xs font-mono text-[#141413] dark:text-[#FAF9F5] whitespace-pre-wrap">
                  {aiResult}
                </div>
              </div>
            )}

            {/* Common Constants Quick Fill */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F] block">
                Quick Formula Snippets
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: 'pi * r^2', expr: 'pi * 5^2' },
                  { label: 'sqrt(a^2 + b^2)', expr: 'sqrt(3^2 + 4^2)' },
                  { label: 'sin(pi/2)', expr: 'sin(pi/2)' },
                  { label: 'log(1000)', expr: 'log(1000)' },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setCalcInput(s.expr);
                    }}
                    className="px-2.5 py-1 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-lg text-[10px] font-mono text-[#8C897F] hover:text-[#D97757] cursor-pointer"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#DFDACB]/60 dark:border-[#2C2B27]/60 text-[11px] text-[#8C897F] flex items-center justify-between">
            <span>Zero external API latency</span>
            <span className="font-mono">In-Browser Math Engine</span>
          </div>
        </div>

      </div>

    </div>
  );
};
