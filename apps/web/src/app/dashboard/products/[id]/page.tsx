'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, deleteProduct, getProductById } from '@/lib/api-client';
import { getBooleanStatusClasses } from '@/lib/crm-styles';
import { formatDate } from '@/lib/formatters';
import { canManageProducts } from '@/lib/permissions';
import type { Product } from '@/types/crm';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const productId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const [product, setProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const canManageProduct = canManageProducts(user);

  async function handleDeleteProduct() {
    if (!token || !productId || !product) {
      setErrorMessage('Your session is not ready. Please try again.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"? This action will remove it from active CRM views.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteProduct(token, productId);
      router.push('/dashboard/products');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Could not delete product.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/products"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to products
        </Link>

        <ErrorState message={errorMessage} />
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
          href="/dashboard/products"
          className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Back to products
        </Link>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Product detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {product.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review product or service information used by the commercial CRM.
            </p>
          </div>

          {canManageProduct ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/products/${product.id}/edit`}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </Link>

              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {product.category ?? 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <div className="mt-2">
              <Badge className={getBooleanStatusClasses(product.isActive)}>
                {product.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(product.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Updated
            </p>
            <p className="mt-2 text-sm text-slate-950">
              {formatDate(product.updatedAt)}
            </p>
          </div>
        </div>

        {product.description ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {product.description}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}