'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProductForm } from '@/components/ProductForm';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getProductById, updateProduct } from '@/lib/api-client';
import type { CreateProductInput, Product } from '@/types/crm';

function getProductInitialValues(product: Product): CreateProductInput {
  return {
    name: product.name,
    description: product.description ?? undefined,
    category: product.category ?? undefined,
    isActive: product.isActive,
  };
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const productId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [product, setProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!token || !productId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getProductById(token, productId);

        if (!isMounted) {
          return;
        }

        setProduct(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load product.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [token, productId]);

  async function handleUpdateProduct(values: CreateProductInput) {
    if (!token || !productId) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedProduct = await updateProduct(token, productId, values);
      router.push(`/dashboard/products/${updatedProduct.id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not update product.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (errorMessage && !product) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/products"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to products
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/products"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to products
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">
            Product not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The product may have been deleted or you may not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Link
          href={`/dashboard/products/${product.id}`}
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to product detail
        </Link>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Edit product
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Update product or service details.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <ProductForm
        initialValues={getProductInitialValues(product)}
        submitLabel="Save changes"
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateProduct}
      />
    </div>
  );
}