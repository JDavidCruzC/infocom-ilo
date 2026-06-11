import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Table as TableIcon, Minus, Link as LinkIcon, Undo, Redo,
  Heading1, Heading2, Heading3, Palette, Highlighter, Quote, Code, ChevronDown, Sparkles,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Orbitron", "Space Grotesk", "Verdana", "Tahoma", "Impact"];

const COLORS = ["#000000", "#374151", "#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#16a34a"];
const HIGHLIGHTS = ["#fef3c7", "#fee2e2", "#dcfce7", "#dbeafe", "#fae8ff", "#f1f5f9"];

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables?: { key: string; label: string }[];
  blocks?: { name: string; html: string }[];
  className?: string;
  minHeight?: number;
}

export function RichEditor({ value, onChange, variables = [], blocks = [], className, minHeight = 400 }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Highlight.configure({ multicolor: true }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-4 py-3 dark:prose-invert prose-headings:font-bold prose-table:border prose-th:border prose-th:bg-muted prose-th:p-1 prose-td:border prose-td:p-1",
        style: `min-height:${minHeight}px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const insertImageFromUrl = () => {
    const url = window.prompt("URL de la imagen");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const insertImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: reader.result as string }).run();
    reader.readAsDataURL(file);
  };
  const insertLink = () => {
    const url = window.prompt("URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={cn("rounded-lg border border-primary/20 bg-card overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-primary/15 bg-secondary/40 p-1.5">
        <Btn onClick={() => editor.chain().focus().undo().run()} icon={<Undo className="h-4 w-4" />} title="Deshacer" />
        <Btn onClick={() => editor.chain().focus().redo().run()} icon={<Redo className="h-4 w-4" />} title="Rehacer" />
        <Sep />

        <Select value={editor.getAttributes("textStyle").fontFamily || "Arial"} onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Fuente" /></SelectTrigger>
          <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
        </Select>

        <Select onValueChange={(v) => {
          const lvl = v === "p" ? 0 : parseInt(v);
          if (lvl === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: lvl as any }).run();
        }}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Estilo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Texto normal</SelectItem>
            <SelectItem value="1">Título 1</SelectItem>
            <SelectItem value="2">Título 2</SelectItem>
            <SelectItem value="3">Título 3</SelectItem>
          </SelectContent>
        </Select>

        <Sep />

        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold className="h-4 w-4" />} title="Negrita" />
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic className="h-4 w-4" />} title="Cursiva" />
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon className="h-4 w-4" />} title="Subrayado" />
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} icon={<Strikethrough className="h-4 w-4" />} title="Tachado" />

        {/* Color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Color de texto"><Palette className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-xs">Color de texto</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-1 p-2">
              {COLORS.map(c => (
                <button key={c} className="h-6 w-6 rounded border" style={{ background: c }} onClick={() => editor.chain().focus().setColor(c).run()} />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>Quitar color</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlight */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Resaltar"><Highlighter className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-xs">Resaltado</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-1 p-2">
              {HIGHLIGHTS.map(c => (
                <button key={c} className="h-6 w-6 rounded border" style={{ background: c }} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetHighlight().run()}>Quitar resaltado</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sep />

        <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={<AlignLeft className="h-4 w-4" />} title="Izquierda" />
        <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={<AlignCenter className="h-4 w-4" />} title="Centrar" />
        <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={<AlignRight className="h-4 w-4" />} title="Derecha" />
        <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} icon={<AlignJustify className="h-4 w-4" />} title="Justificar" />

        <Sep />

        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List className="h-4 w-4" />} title="Lista con viñetas" />
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered className="h-4 w-4" />} title="Lista numerada" />
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={<Quote className="h-4 w-4" />} title="Cita" />
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} icon={<Code className="h-4 w-4" />} title="Código" />

        <Sep />

        <Btn onClick={insertLink} icon={<LinkIcon className="h-4 w-4" />} title="Enlace" />
        <Btn onClick={insertImageFromUrl} icon={<ImageIcon className="h-4 w-4" />} title="Imagen por URL" />
        <label className="cursor-pointer">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Subir imagen">
            <span><ImageIcon className="h-4 w-4 text-primary" /></span>
          </Button>
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImageFromFile(f); e.target.value = ""; }} />
        </label>
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={<TableIcon className="h-4 w-4" />} title="Insertar tabla" />
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={<Minus className="h-4 w-4" />} title="Línea horizontal" />

        {/* Variables */}
        {variables.length > 0 && (
          <>
            <Sep />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <Sparkles className="h-3 w-3 text-primary" /> Variables <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 overflow-auto">
                <DropdownMenuLabel className="text-xs">Insertar variable dinámica</DropdownMenuLabel>
                {variables.map(v => (
                  <DropdownMenuItem key={v.key} onClick={() => editor.chain().focus().insertContent(`{{${v.key}}}`).run()}>
                    <span className="font-mono text-xs text-primary mr-2">{`{{${v.key}}}`}</span>
                    <span className="text-xs text-muted-foreground">{v.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Blocks */}
        {blocks.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                Bloques <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel className="text-xs">Insertar bloque</DropdownMenuLabel>
              {blocks.map(b => (
                <DropdownMenuItem key={b.name} onClick={() => editor.chain().focus().insertContent(b.html).run()}>
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Btn({ onClick, icon, title, active }: { onClick: () => void; icon: React.ReactNode; title: string; active?: boolean }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-6 w-px bg-border" />;
}

/** Replace {{var.path}} placeholders with provided data. Supports nested paths. */
export function renderTemplateHtml(html: string, data: Record<string, any>): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const parts = String(path).split(".");
    let val: any = data;
    for (const p of parts) val = val?.[p];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

/** Open a print window with the given HTML and trigger print. */
export function printHtml(html: string, opts: { title?: string; paper?: "a4" | "ticket_80mm" } = {}) {
  const title = opts.title || "Comprobante";
  const paper = opts.paper || "a4";
  const pageCss = paper === "ticket_80mm"
    ? `@page { size: 80mm auto; margin: 4mm; } body { width: 72mm; font-family: 'Courier New', monospace; font-size: 11px; }`
    : `@page { size: A4; margin: 12mm; } body { font-family: Arial, sans-serif; font-size: 12px; }`;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
${pageCss}
* { box-sizing: border-box; }
body { color: #000; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 6px; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #999; margin: 8px 0; }
h1,h2,h3 { margin: 6px 0; }
mark { padding: 0 2px; }
</style></head><body>${html}<script>window.onload=()=>{setTimeout(()=>{window.print();},250);};window.onafterprint=()=>window.close();</script></body></html>`);
  w.document.close();
}
