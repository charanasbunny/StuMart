import { Link } from "react-router";
import { useEffect, useState, useRef } from "react";
import { getProducts } from "../services/productService";
import FeaturedProduct from "../components/home/FeaturedProduct";

const CARD_WIDTH = 324; // 300px card + 24px margin (mx-3)

export default function Home() {
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isSnapping, setIsSnapping] = useState(false);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1024 : window.innerWidth
  );

  const n = featuredProducts.length;
  const visibleCards = Math.max(1, Math.ceil(viewportWidth / CARD_WIDTH));
  const cloneCount = n > 0 ? Math.min(n, isMobile ? 1 : visibleCards) : 0;
  const extendedProducts =
    n > 0
      ? [
          ...featuredProducts.slice(-cloneCount),
          ...featuredProducts,
          ...featuredProducts.slice(0, cloneCount),
        ]
      : [];

  const maxIndex = n + cloneCount;
  const clampIndex = (value) => Math.max(cloneCount - 1, Math.min(value, maxIndex));

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const result = await getProducts({ limit: 6 });
        if (result.success) {
          setFeaturedProducts(result.data || []);
        }
      } catch (error) {
        console.error("Error fetching featured products:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setViewportWidth(window.innerWidth);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);

    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    if (n === 0) return;
    setCurrentIndex(cloneCount || 1);
  }, [n, cloneCount]);

  useEffect(() => {
    if (n === 0 || isHovering) return;

    const autoScrollDelay = isMobile ? 4200 : 2800;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => clampIndex(prev + 1));
    }, autoScrollDelay);

    return () => clearInterval(interval);
  }, [n, isHovering, isMobile, cloneCount]);

  useEffect(() => {
    const updateScrollIndicator = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      const isAtBottom = scrollPosition >= pageHeight - 8;
      setShowScrollIndicator(!isAtBottom);
    };

    updateScrollIndicator();
    window.addEventListener("scroll", updateScrollIndicator, { passive: true });
    window.addEventListener("resize", updateScrollIndicator);

    return () => {
      window.removeEventListener("scroll", updateScrollIndicator);
      window.removeEventListener("resize", updateScrollIndicator);
    };
  }, []);

  // After sliding to a clone, snap to the real position without animation (seamless loop)
  const handleCarouselTransitionEnd = () => {
    if (n === 0) return;
    if (currentIndex >= n + cloneCount) {
      setIsSnapping(true);
      requestAnimationFrame(() => {
        setCurrentIndex(cloneCount || 1);
        requestAnimationFrame(() => setIsSnapping(false));
      });
    } else if (currentIndex < cloneCount) {
      setIsSnapping(true);
      requestAnimationFrame(() => {
        setCurrentIndex(n + cloneCount - 1);
        requestAnimationFrame(() => setIsSnapping(false));
      });
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;

    const distance = touchStartX.current - touchEndX.current;

    if (distance > 50) {
      setCurrentIndex((prev) => clampIndex(prev + 1));
    }
    if (distance < -50) {
      setCurrentIndex((prev) => clampIndex(prev - 1));
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100 overflow-x-hidden">
      <h1 className="sr-only">
        AANM & VVRSR Student Marketplace
      </h1>
      <section className="w-full relative overflow-hidden min-h-[50vh] sm:min-h-[55vh] md:min-h-[60vh] flex items-center pt-8 pb-12 sm:pt-6 sm:pb-8 md:pt-3 md:pb-0">
        <div
          className="absolute inset-0 z-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/bg-student-illustration.png.jpeg')",
            backgroundSize: isMobile ? "100%" : "120%",
            backgroundPosition: "center",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-white/75 md:bg-white/60 z-10 pointer-events-none"
          aria-hidden="true"
        />
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-20 hidden md:block">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-30 max-w-6xl mx-auto px-5 py-8 sm:py-12 md:py-20 lg:py-28 text-center w-full min-w-0">
          <p className="font-cinzel text-xs sm:text-sm md:text-base lg:text-lg uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-600 mb-3 sm:mb-2 md:mb-3 md:animate-fade-in-up">
            Welcome to
          </p>
          <div className="mb-4 sm:mb-6 md:mb-7 lg:mb-8 md:animate-fade-in-up md:animate-fade-in-up-delay-1 w-full overflow-hidden">
            <span className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-cinzel font-bold block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent md:animate-gradient leading-none break-words mx-auto max-w-full">
              GvlPolyMart
            </span>
          </div>
          <p className="font-display text-sm sm:text-base md:text-xl lg:text-2xl font-semibold text-gray-900 max-w-3xl mx-auto mb-4 sm:mb-2 md:mb-3 lg:mb-4 leading-snug md:leading-relaxed md:animate-fade-in-up md:animate-fade-in-up-delay-2">
            <span className="hidden sm:inline">Why carry extra items when campus life is already busy? Sell what you no longer need in minutes.</span>
            <span className="sm:hidden">Sell your extra items. Lighten the load.</span>
          </p>

          {showScrollIndicator && (
            <button
              type="button"
              className="fixed left-1/2 bottom-6 -translate-x-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/80 shadow-md hover:shadow-lg hover:opacity-90 transition-all z-50"
              onClick={() => {
                window.scrollBy({
                  top: window.innerHeight * 0.8,
                  behavior: "smooth",
                });
              }}
              aria-label="Scroll down"
            >
              <div className="animate-bounce">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </button>
          )}

          <p className="text-xs sm:text-sm md:text-base text-gray-500 max-w-xl mx-auto mb-5 sm:mb-3 md:animate-fade-in-up md:animate-fade-in-up-delay-2">
            <Link to="/about" className="text-indigo-600 hover:text-indigo-700 font-medium">
              By students, for students
            </Link>
          </p>
          <p className="text-sm sm:text-sm md:text-base lg:text-lg font-normal text-gray-600 max-w-2xl mx-auto mb-3 sm:mb-6 md:mb-8 lg:mb-10 md:animate-fade-in-up md:animate-fade-in-up-delay-3 hidden sm:block">
            A trusted platform where students exchange academic essentials safely
            within their college community.
          </p>
          <div className="flex flex-row justify-center items-center gap-3 sm:gap-3 w-full sm:w-auto md:animate-fade-in-up md:animate-fade-in-up-delay-4 mt-1">
            <Link
              to="/products"
              className="font-display cta-hero cta-hero-pulse inline-flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-blue-600 text-white text-sm sm:text-lg font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow-[0_10px_30px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_40px_rgba(99,102,241,0.6)] ring-2 ring-indigo-300/70 hover:ring-indigo-200/90 hover:scale-[1.03]"
              aria-label="Browse all products"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Browse Products</span>
              <span className="sm:hidden">Browse</span>
            </Link>
            <Link
              to="/create-post"
              className="font-display inline-flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-4 bg-gradient-to-r from-indigo-50 via-white to-indigo-100 text-indigo-700 text-sm sm:text-lg font-semibold rounded-lg sm:rounded-xl border-2 border-indigo-300/90 hover:border-indigo-400 transition-all duration-300 shadow-[0_12px_32px_rgba(99,102,241,0.35)] hover:shadow-[0_18px_44px_rgba(99,102,241,0.55)] ring-2 ring-indigo-200/80 hover:bg-white hover:scale-[1.03]"
              aria-label="Sell an item"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Sell an item</span>
              <span className="sm:hidden">Sell</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        id="featured-products"
        className="max-w-6xl mx-auto px-4 py-5 md:py-12 lg:py-16"
      >
        <div className="flex items-center justify-between mb-3 md:mb-6 lg:mb-8">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-indigo-600 mb-0.5 sm:mb-1">Campus listings</p>
            <h2 className="font-display text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              Featured Products
            </h2>
          </div>
          <Link
            to="/products"
            className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-2 transition-colors"
          >
            View All
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {isLoadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="bg-white/80 rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <p className="text-gray-600 mb-4">No listings yet. Be the first to list an item.</p>
            <Link
              to="/create-post"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
            >
              List an item
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        ) : (
          <>
            <div
              className="relative overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <button
                onClick={() => setCurrentIndex((prev) => clampIndex(prev - 1))}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all duration-300 flex items-center justify-center"
                aria-label="Previous product"
              >
                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${currentIndex * CARD_WIDTH}px)`,
                  transition: isSnapping ? "none" : undefined,
                }}
                onTransitionEnd={handleCarouselTransitionEnd}
              >
                {extendedProducts.map((product, index) => (
                  <FeaturedProduct product={product} index={index} currentIndex={currentIndex} />
                ))}
              </div>
              <button
                onClick={() => setCurrentIndex((prev) => clampIndex(prev + 1))}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all duration-300 flex items-center justify-center"
                aria-label="Next product"
              >
                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex justify-center gap-2 mt-6" aria-label="Carousel position">
              {featuredProducts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIndex(cloneCount + i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    currentIndex === cloneCount + i ? "bg-indigo-600" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="hidden md:block max-w-6xl mx-auto px-4 py-8 md:py-12 lg:py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 text-center mb-2">Why us</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2 md:mb-3 lg:mb-4">
          Why Choose GvlPolyMart?
        </h2>
        <p className="text-center text-gray-600 mb-6 md:mb-12 max-w-2xl mx-auto">
          A trusted, campus-only marketplace built by students — for students.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div
              className="premium-icon premium-icon--filled w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center mb-3 md:mb-4 mx-auto"
              style={{
                "--premium-glow": "79 70 229",
                "--premium-fill": "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
            >
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 text-center">Verified Student Network</h3>
            <p className="text-gray-600 text-center text-sm md:text-base leading-relaxed">
              Only PIN-verified students can list and buy. A safe, trusted environment for the campus.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div
              className="premium-icon premium-icon--filled w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center mb-3 md:mb-4 mx-auto"
              style={{
                "--premium-glow": "168 85 247",
                "--premium-fill": "linear-gradient(135deg, #a855f7, #ec4899)",
              }}
            >
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-sm md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 text-center">Campus-Based Exchange</h3>
            <p className="text-gray-600 text-center text-sm md:text-base leading-relaxed">
              Simple, safe, and designed exclusively for AANM & VVRSR Polytechnic students.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div
              className="premium-icon premium-icon--filled w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center mb-3 md:mb-4 mx-auto"
              style={{
                "--premium-glow": "16 185 129",
                "--premium-fill": "linear-gradient(135deg, #10b981, #22c55e)",
              }}
            >
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm md:text-xl font-semibold mb-2 md:mb-3 text-gray-900 text-center">Affordable & Sustainable</h3>
            <p className="text-gray-600 text-center text-sm md:text-base leading-relaxed">
              Save money on used books and essentials; reuse within campus and reduce waste.
            </p>
          </div>
        </div>
      </section>

      {/* Browse by category */}
      <section className="max-w-6xl mx-auto px-5 py-12 pb-16 md:py-14 md:pb-16 w-full min-w-0 overflow-x-hidden">
        <div className="text-center mb-8 w-full min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600 mb-2">Browse</p>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words px-1">Shop by category</h2>
          <p className="text-sm md:text-base text-gray-600 mt-2 break-words px-1 max-w-xl mx-auto">
            Find what you need fast, curated for campus life.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              value: "books",
              label: "Books",
              detail: "Notes, guides, manuals",
              glow: "79 70 229",
              fill: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              icon: (
                <svg className="w-5 h-5 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h10a2 2 0 012 2v15a1 1 0 01-1.447.894L12 18.118l-4.553 2.776A1 1 0 016 20V5a2 2 0 00-2-2z" />
                </svg>
              ),
            },
            {
              value: "stationary",
              label: "Stationery",
              detail: "Essentials & supplies",
              glow: "168 85 247",
              fill: "linear-gradient(135deg, #a855f7, #ec4899)",
              icon: (
                <svg className="w-5 h-5 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7l-1-4H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-6 4h6" />
                </svg>
              ),
            },
            {
              value: "electronics",
              label: "Electronics",
              detail: "Gadgets & accessories",
              glow: "16 185 129",
              fill: "linear-gradient(135deg, #10b981, #22c55e)",
              icon: (
                <svg className="w-5 h-5 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3h4.5a1.5 1.5 0 011.5 1.5v15a1.5 1.5 0 01-1.5 1.5h-4.5a1.5 1.5 0 01-1.5-1.5v-15A1.5 1.5 0 019.75 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01" />
                </svg>
              ),
            },
            {
              value: "others",
              label: "Others",
              detail: "Any other items",
              tone: "from-rose-500 to-pink-500",
              icon: (
                <svg className="w-5 h-5 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
              ),
            },
          ].map((cat) => (
            <Link
              key={cat.value}
              to={`/products?category=${cat.value}`}
              className="group category-card-premium rounded-2xl px-4 py-5 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <div
                  className="premium-icon premium-icon--filled w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    "--premium-glow": cat.glow,
                    "--premium-fill": cat.fill,
                  }}
                >
                  {cat.icon}
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="mt-4">
                <p className="text-sm md:text-base font-semibold text-gray-900">
                  {cat.label}
                </p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">{cat.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* <section className="max-w-6xl mx-auto px-4 py-8 md:py-12 lg:py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 text-center mb-2">Get started</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2 md:mb-3 lg:mb-4">
          How It Works
        </h2>
        <p className="text-center text-gray-600 mb-6 md:mb-8 lg:mb-12 max-w-2xl mx-auto">
          Buy and sell academic essentials safely within your campus.
        </p>
        <div className="grid grid-cols-2 gap-4 md:gap-8 md:grid-cols-4">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-[140px] md:text-[200px] font-semibold text-transparent bg-gradient-to-br from-indigo-400 to-indigo-500 bg-clip-text opacity-20 select-none leading-none"
                style={{ WebkitTextStroke: "1px rgba(129, 140, 248, 0.3)" }}
              >
                1
              </span>
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-400 shadow-md flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg
                  className="w-6 h-6 md:w-8 md:h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 md:hidden">
                Register and log in.
              </p>
              <h3 className="hidden md:block font-semibold text-gray-900 mb-2 text-lg">
                Register & Login
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed hidden md:block">
                Create your account using your student email and verify your credentials.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-[140px] md:text-[200px] font-semibold text-transparent bg-gradient-to-br from-purple-400 to-purple-500 bg-clip-text opacity-20 select-none leading-none"
                style={{ WebkitTextStroke: "1px rgba(168, 85, 247, 0.3)" }}
              >
                2
              </span>
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-md flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg
                  className="w-6 h-6 md:w-8 md:h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 md:hidden">
                Post items or browse listings.
              </p>
              <h3 className="hidden md:block font-semibold text-gray-900 mb-2 text-lg">
                Post or Browse
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed hidden md:block">
                List items you want to sell with photos, or browse available products from other students.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-[140px] md:text-[200px] font-semibold text-transparent bg-gradient-to-br from-green-400 to-green-500 bg-clip-text opacity-20 select-none leading-none"
                style={{ WebkitTextStroke: "1px rgba(74, 222, 128, 0.3)" }}
              >
                3
              </span>
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-400 shadow-md flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg
                  className="w-6 h-6 md:w-8 md:h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 md:hidden">
                Contact the seller directly.
              </p>
              <h3 className="hidden md:block font-semibold text-gray-900 mb-2 text-lg">
                Contact Seller
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed hidden md:block">
                Reach out directly to sellers through the platform to ask questions and negotiate.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-[140px] md:text-[200px] font-semibold text-transparent bg-gradient-to-br from-pink-400 to-pink-500 bg-clip-text opacity-20 select-none leading-none"
                style={{ WebkitTextStroke: "1px rgba(244, 114, 182, 0.3)" }}
              >
                4
              </span>
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 shadow-md flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg
                  className="w-6 h-6 md:w-8 md:h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 md:hidden">
                Meet and exchange safely.
              </p>
              <h3 className="hidden md:block font-semibold text-gray-900 mb-2 text-lg">
                Meet & Exchange
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed hidden md:block">
                Arrange a meeting on campus to complete the transaction in person. Prefer a busy, public spot for safety.
              </p>
            </div>
          </div>
        </div>
      </section> */}
    </div>
  );
}