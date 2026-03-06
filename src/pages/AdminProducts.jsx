import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentAdmin } from "../services/adminService";
import { getAllProductsForAdmin, adminDeleteProduct } from "../services/productService";
import { normalizeBranchCode } from "../utils/branchCodes";
import useDebouncedValue from "../hooks/useDebouncedValue";
import AdminLayout from "../components/admin/AdminLayout";

export default function AdminProducts() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  /* ---------------- FILTER STATE ---------------- */
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState("all");
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  /* ---------------- OPTIONS ---------------- */
  const categoryOptions = [
    { value: "books", label: "Books" },
    { value: "stationary", label: "Stationery" },
    { value: "electronics", label: "Electronics" },
    { value: "others", label: "Others" },
  ];

  const branchOptions = [
    { value: "CM", label: "CM (Computer Science)" },
    { value: "C", label: "C (Civil)" },
    { value: "M", label: "M (Mechanical)" },
    { value: "EC", label: "EC" },
    { value: "EE", label: "EE" },
    { value: "CIOT", label: "CIOT" },
    { value: "AIM", label: "AIM" },
  ];

  const priceOptions = [
    { value: "all", label: "All Prices" },
    { value: "0-100", label: "₹0 - ₹100" },
    { value: "100-500", label: "₹100 - ₹500" },
    { value: "500-1000", label: "₹500 - ₹1000" },
    { value: "1000-5000", label: "₹1000 - ₹5000" },
    { value: "5000+", label: "₹5000+" },
  ];

  /* ---------------- LOAD ADMIN + PRODUCTS ---------------- */
  const loadProducts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const { admin } = await getCurrentAdmin();
        if (!admin) {
          navigate("/login?type=admin");
          return;
        }

        const res = await getAllProductsForAdmin();
        if (!res.success) {
          setLoadError(res.error || "Failed to load products");
          setProducts([]);
        } else {
          setLoadError("");
          setProducts(res.data || []);
        }
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error loading products:", error);
        setLoadError("Failed to load products");
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  /* ---------------- FILTER LOGIC ---------------- */
  useEffect(() => {
    let list = [...products];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        p =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.student_pin_number?.toLowerCase().includes(q)
      );
    }

    if (selectedCategories.length) {
      list = list.filter(p => selectedCategories.includes(p.category));
    }

    if (selectedBranches.length) {
      list = list.filter(p =>
        p.branch ? selectedBranches.includes(normalizeBranchCode(p.branch)) : false
      );
    }

    if (showFreeOnly) {
      list = list.filter(p => parseInt(p.price) === 0);
    }

    if (selectedPriceRange !== "all") {
      const [min, max] =
        selectedPriceRange === "5000+"
          ? [5000, Infinity]
          : selectedPriceRange.split("-").map(Number);

      list = list.filter(p => {
        const price = parseInt(p.price || 0);
        return price >= min && price <= max;
      });
    }

    setFilteredProducts(list);
  }, [
    products,
    debouncedSearch,
    selectedCategories,
    selectedBranches,
    selectedPriceRange,
    showFreeOnly,
  ]);

  /* ---------------- HELPERS ---------------- */
  const getImage = imgs =>
    imgs?.length ? imgs[0] : "https://via.placeholder.com/400x300";

  const handleDelete = async id => {
    if (!window.confirm("Delete this product?")) return;
    if (!window.confirm("This is permanent. Confirm delete.")) return;

    setDeletingId(id);
    const result = await adminDeleteProduct(id);
    if (result.success) {
      setProducts(prev =>
        prev.map(p => (p.id === id ? { ...p, status: "inactive" } : p))
      );
      setSelectedProductIds((prev) => prev.filter((itemId) => itemId !== id));
      setNotice({ type: "success", message: "Product moved to inactive." });
    } else {
      setNotice({ type: "error", message: result.error || "Failed to delete product." });
    }
    setDeletingId(null);
  };

  /* ---------------- FILTER SIDEBAR ---------------- */
  const activeFilterCount =
    selectedCategories.length +
    selectedBranches.length +
    (selectedPriceRange !== "all" ? 1 : 0) +
    (showFreeOnly ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedBranches([]);
    setSelectedPriceRange("all");
    setShowFreeOnly(false);
  };

  const clearSearch = () => setSearchQuery("");

  const resetAll = () => {
    clearAllFilters();
    clearSearch();
  };

  const toggleSelectProduct = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedProductIds(filteredProducts.map((item) => item.id));
  };

  const clearSelection = () => setSelectedProductIds([]);

  const handleBulkAction = async (mode) => {
    if (selectedProductIds.length === 0) return;
    const message =
      mode === "delete"
        ? "Delete selected products? (They will be marked inactive.)"
        : "Hide selected products? (They will be marked inactive.)";
    if (!window.confirm(message)) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedProductIds) {
      const result = await adminDeleteProduct(id);
      if (result.success) {
        successCount += 1;
      } else {
        failCount += 1;
      }
    }

    if (successCount > 0) {
      setProducts((prev) =>
        prev.map((p) =>
          selectedProductIds.includes(p.id) ? { ...p, status: "inactive" } : p
        )
      );
    }

    if (failCount > 0) {
      setNotice({
        type: "error",
        message: `Updated ${successCount} item(s). ${failCount} failed.`,
      });
    } else {
      setNotice({
        type: "success",
        message: `${successCount} item(s) updated.`,
      });
    }

    setSelectedProductIds([]);
    setIsBulkProcessing(false);
  };

  const hasAllFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((item) => selectedProductIds.includes(item.id));

  useEffect(() => {
    setSelectedProductIds((prev) =>
      prev.filter((id) => filteredProducts.some((item) => item.id === id))
    );
  }, [filteredProducts]);

  if (isLoading) {
    return <div className="p-10 text-center">Loading…</div>;
  }

  const activeChips = [];
  if (searchQuery.trim()) {
    activeChips.push({ key: "search", label: `Search: ${searchQuery}` });
  }
  selectedCategories.forEach((value) => {
    const label = categoryOptions.find((opt) => opt.value === value)?.label || value;
    activeChips.push({ key: `cat-${value}`, label });
  });
  selectedBranches.forEach((value) => {
    const label = branchOptions.find((opt) => opt.value === value)?.label || value;
    activeChips.push({ key: `branch-${value}`, label });
  });
  if (selectedPriceRange !== "all") {
    const label = priceOptions.find((opt) => opt.value === selectedPriceRange)?.label;
    activeChips.push({ key: "price", label: label || selectedPriceRange });
  }
  if (showFreeOnly) {
    activeChips.push({ key: "free", label: "Free only" });
  }

  const FilterSidebar = ({ isMobile = false }) => (
    <div className="w-full lg:w-64 bg-white border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-gray-900">Filters</h3>
        {isMobile && (
          <button onClick={() => setIsFilterOpen(false)} aria-label="Close filters">✕</button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold mb-2">Category</p>
          {categoryOptions.map(c => (
            <label key={c.value} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.value)}
                onChange={() =>
                  setSelectedCategories(prev =>
                    prev.includes(c.value)
                      ? prev.filter(x => x !== c.value)
                      : [...prev, c.value]
                  )
                }
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold mb-2">Branch</p>
          {branchOptions.map(b => (
            <label key={b.value} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedBranches.includes(b.value)}
                onChange={() =>
                  setSelectedBranches(prev =>
                    prev.includes(b.value)
                      ? prev.filter(x => x !== b.value)
                      : [...prev, b.value]
                  )
                }
              />
              {b.label}
            </label>
          ))}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold mb-2">Price</p>
          {priceOptions.map(r => (
            <label key={r.value} className="flex gap-2 text-sm">
              <input
                type="radio"
                name="price"
                checked={selectedPriceRange === r.value}
                onChange={() => setSelectedPriceRange(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>

        <div className="border-t pt-4">
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={showFreeOnly}
              onChange={e => setShowFreeOnly(e.target.checked)}
            />
            Free only
          </label>
        </div>

        <button
          onClick={clearAllFilters}
          className="w-full border rounded py-2 text-sm"
        >
          Clear filters
        </button>
      </div>
    </div>
  );

  /* ---------------- UI ---------------- */
  return (
    <AdminLayout
      title="Products"
      subtitle="Monitor, review, and moderate listings."
      lastUpdated={lastUpdated}
      onRefresh={() => loadProducts(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {loadError && (
          <div className="admin-alert admin-alert--error">{loadError}</div>
        )}
        {notice && (
          <div
            className={`admin-alert ${notice.type === "success" ? "admin-alert--success" : "admin-alert--error"}`}
          >
            {notice.message}
          </div>
        )}

        <div className="admin-card p-3 sm:p-4 flex flex-col gap-3 admin-sticky-toolbar">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">Search</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search title, description, or PIN"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg text-sm"
                  aria-label="Open filters"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M10 18h4" />
                  </svg>
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {(searchQuery || activeFilterCount > 0) && (
              <button onClick={resetAll} className="admin-button admin-button--ghost">
                Clear all
              </button>
            )}
          </div>
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <span key={chip.key} className="admin-chip">
                  {chip.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Showing {filteredProducts.length} item(s)</span>
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={hasAllFilteredSelected ? clearSelection : selectAllFiltered}
                className="admin-button admin-button--ghost"
              >
                {hasAllFilteredSelected ? "Clear selection" : "Select all"}
              </button>
            )}
            {selectedProductIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span>{selectedProductIds.length} selected</span>
                <button
                  type="button"
                  onClick={() => handleBulkAction("hide")}
                  disabled={isBulkProcessing}
                  className="admin-button"
                >
                  Hide
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction("delete")}
                  disabled={isBulkProcessing}
                  className="admin-button admin-button--ghost"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="hidden lg:block">
            <FilterSidebar />
          </div>

          <div className="flex-1">
            {filteredProducts.length === 0 ? (
              <div className="admin-card p-6 text-center text-sm text-gray-500">
                No products match your filters.
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button onClick={resetAll} className="admin-button">
                    Reset filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(p => (
                  <div
                    key={p.id}
                    className="admin-card overflow-hidden flex flex-col relative"
                  >
                    <div className="admin-select-wrap">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleSelectProduct(p.id)}
                        className="admin-select"
                        aria-label={`Select ${p.title}`}
                      />
                    </div>
                    <div className="admin-media-frame aspect-[4/3] lg:aspect-[16/9]">
                      <img
                        src={getImage(p.image_urls)}
                        alt={p.title}
                        className="admin-media-image"
                        loading="lazy"
                      />
                    </div>

                    <div className="p-3 flex flex-col flex-1 space-y-2">
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="font-semibold hover:text-emerald-700 text-xs sm:text-sm"
                      >
                        {p.title}
                      </Link>

                      <p className="text-xs sm:text-sm text-gray-600">
                        {parseInt(p.price, 10) === 0 ? "FREE" : `₹ ${parseInt(p.price, 10)}`}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <Link
                          to={`/admin/products/${p.id}`}
                          className="h-9 flex items-center justify-center bg-emerald-600 text-white text-xs sm:text-sm rounded-lg"
                        >
                          View
                        </Link>

                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="h-9 flex items-center justify-center bg-rose-600 text-white rounded-lg disabled:opacity-60"
                          aria-label="Delete product"
                          title="Delete"
                        >
                          {deletingId === p.id ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M22 12a10 10 0 0 1-10 10" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isFilterOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setIsFilterOpen(false)}
            />
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 overflow-y-auto">
              <FilterSidebar isMobile />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
