'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProductForm } from '@/components/ProductForm';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, createProduct } from '@/lib/api-client';
import type { CreateProductInput } from '@/types/crm';

export default function NewProductPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateProduct(values: CreateProductInput) {
    if (!token) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const product = await createProduct(token, values);
      router.push(`/dashboard/products/${product.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not create product.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href="/dashboard/products"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to products
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            New product
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Create a product or service that can support future commercial
            workflows.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <ProductForm
        submitLabel="Create product"
        isSubmitting={isSubmitting}
        onSubmit={handleCreateProduct}
      />
    </div>
  );
}