import { useState } from "react";

export // утилита для одного поля формы
function useGlobalToggleWithDraft<T extends Record<string, any>>(
  form: {
    getInputProps: any;
    setFieldValue: (k: string, v: any) => void;
    clearFieldError: (k: string) => void;
    values: T;
  },
  field: keyof T & string,
  useGlobal: boolean,
  setUseGlobal: (v: boolean) => void,
  globalValue: string | number | null | undefined
) {
  const [draft, setDraft] = useState<string>("");

  const enableGlobal = () => {
    // запоминаем текущий драфт
    setDraft(String(form.values[field] ?? ""));
    // подставляем глобальное
    if (globalValue != null) {
      form.setFieldValue(field, String(globalValue));
      form.clearFieldError(field);
    }
    setUseGlobal(true);
  };

  const disableGlobal = () => {
    // восстанавливаем сохранённый драфт
    form.setFieldValue(field, draft);
    setUseGlobal(false);
  };

  const toggle = (next: boolean) => {
    if (next && !useGlobal) enableGlobal();
    else if (!next && useGlobal) disableGlobal();
  };

  return { toggle };
}
