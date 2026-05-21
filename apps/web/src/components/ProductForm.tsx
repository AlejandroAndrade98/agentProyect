'use client';

import { FormEvent, useState } from 'react';

import type { CreateProductInput } from '@/types/crm';

type ProductFormProps = {
  initialValues?: Partial<CreateProductInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateProductInput) => Promise<void>;
};

function cleanOptionalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function ProductForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name: name.trim(),
      description: cleanOptionalValue(description),
      category: cleanOptionalValue(category),
      isActive,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="product-name"
            className="text-sm font-medium text-slate-700"
          >
            Product name
          </label>
          <input
            id="product-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="CRM consulting package"
          />
        </div>

        <div>
          <label
            htmlFor="product-category"
            className="text-sm font-medium text-slate-700"
          >
            Category
          </label>
          <input
            id="product-category"
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Service, Software, Ads..."
          />
        </div>

        <div className="flex items-end">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 px-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active product
          </label>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="product-description"
            className="text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="product-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="Describe what this product or service includes..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}