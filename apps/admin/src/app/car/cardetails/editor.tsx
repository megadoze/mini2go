import { useEffect } from "react";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Superscript from "@tiptap/extension-superscript";
import SubScript from "@tiptap/extension-subscript";
import ColorPicker from "@tiptap/extension-color";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
// import { v4 as uuidv4 } from "uuid";

type EditorProps = {
  value: string;
  onChange: (val: string) => void;
};

function Editor({ value, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false, // отключим здесь
        orderedList: false,
        listItem: false,
      }),
      ListItem,
      BulletList,
      OrderedList,
      Superscript,
      SubScript,
      Highlight,
      TextStyle,
      ColorPicker, // 👈 должен идти после TextStyle
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount.configure({
        limit: 3000,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          event.preventDefault();
          view.dispatch(
            view.state.tr.insertText(
              text,
              view.state.selection.from,
              view.state.selection.to
            )
          );
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value]);

  return (
    <RichTextEditor editor={editor} variant="subtle">
      <RichTextEditor.Toolbar sticky stickyOffset={60}>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Highlight />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ColorPicker
          colors={[
            "#25262b",
            "#868e96",
            "#fa5252",
            "#e64980",
            "#be4bdb",
            "#7950f2",
            "#4c6ef5",
            "#228be6",
            "#15aabf",
            "#12b886",
            "#40c057",
            "#82c91e",
            "#fab005",
            "#fd7e14",
          ]}
        />

        <RichTextEditor.ClearFormatting />

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.H4 />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.Hr />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.AlignLeft />
          <RichTextEditor.AlignCenter />
          <RichTextEditor.AlignJustify />
          <RichTextEditor.AlignRight />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Undo />
          <RichTextEditor.Redo />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>
      {editor && editor.storage.characterCount && (
        <div className="mt-0 px-0">
          <div
            className="h-[3px] bg-gray-100 overflow-hidden"
            aria-hidden="true"
          >
            <div
              className={`h-full transition-all duration-300 ${
                editor.storage.characterCount.characters() > 3000
                  ? "bg-red-500"
                  : "bg-cyan-600/80"
              }`}
              style={{
                width: `${Math.min(
                  (editor.storage.characterCount.characters() / 3000) * 100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      <RichTextEditor.Content className="text-left overflow-y-auto min-h-60 [&_blockquote]:text-base prose prose-sm [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" />
      {editor && editor.storage.characterCount && (
        <div className="mt-2 pr-1 space-y-1">
          <div
            className={` text-right text-sm transition-colors duration-300 ${
              editor.storage.characterCount.characters() > 3000
                ? "text-red-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            Символов: {editor.storage.characterCount.characters()}/3000 Слов:{" "}
            {editor.storage.characterCount.words()}
          </div>

          {editor.storage.characterCount.characters() > 3000 && (
            <div className="text-right text-xs text-red-500">
              Превышен лимит — ввод блокируется
            </div>
          )}
        </div>
      )}
    </RichTextEditor>
  );
}

export default Editor;
