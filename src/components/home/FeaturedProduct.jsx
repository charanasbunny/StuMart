import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export default function FeaturedProduct({ product, index, currentIndex }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useLocalStorage("likedPosts", []);
  const imageRef = useRef(null);
  const imageWrapperRef = useRef(null);
  const lastTouchRef = useRef(0);
  const productId = String(product.id);

  const isRecentTouch = () => Date.now() - lastTouchRef.current < 450;

  const isLiked = Array.isArray(likedPosts)
    ? likedPosts.some((item) => String(typeof item === "object" ? item.id : item) === productId)
    : false;

  const formatPrice = (price) => {
    const numPrice = parseInt(price, 10);
    if (numPrice === 0) return "FREE";
    return `₹ ${numPrice.toFixed(0)}`;
  };

  const getFirstImage = (imageUrls) => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls[0];
    }
    return "https://via.placeholder.com/400x300?text=No+Image";
  };

  const productUrl = `${window.location.origin}/products/${product.id}`;

  const handleToggleLike = (e) => {
    if (e?.type === "click" && isRecentTouch()) {
      return;
    }
    e?.stopPropagation?.();

    let updatedLikedPosts = [];
    if (isLiked) {
      updatedLikedPosts = likedPosts.filter(
        (item) => String(typeof item === "object" ? item.id : item) !== productId,
      );
    } else {
      updatedLikedPosts = [...likedPosts, product];
    }

    setLikedPosts(updatedLikedPosts);
  };

  const handleShare = async (e) => {
    if (e?.type === "click" && isRecentTouch()) {
      return;
    }
    e?.stopPropagation?.();

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.title,
          text: product.title,
          url: productUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(productUrl);
        return;
      }
    } catch (error) {
      console.error("Share failed:", error);
    }

    window.prompt("Copy this link", productUrl);
  };

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!imageWrapperRef.current) return;
      if (!imageWrapperRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);
  return (
    <div
      key={`${product.id}-${index}`}
      onClick={() => navigate(`/products/${product.id}`)}
      onMouseEnter={() => setIsMenuOpen(true)}
      onMouseLeave={() => setIsMenuOpen(false)}
      className={`min-w-[300px] mx-3 bg-white rounded-xl shadow-md cursor-pointer transition-all duration-500
                      ${
                        index === currentIndex
                          ? "scale-110 shadow-xl z-10"
                          : "scale-95 opacity-80"
                      }
                    `}
    >
      <div
        className="relative h-48 bg-gray-100 flex items-center justify-center"
        ref={imageWrapperRef}
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => setIsMenuOpen(false)}
        onTouchEnd={(e) => {
          lastTouchRef.current = Date.now();
          const touch = e.changedTouches?.[0];
          const rect = imageRef.current?.getBoundingClientRect();
          if (!touch || !rect) return;

          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = touch.clientX - centerX;
          const dy = touch.clientY - centerY;
          const distance = Math.hypot(dx, dy);
          const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const angleFromTop = ((rawAngle + 90 + 180) % 360) - 180;

          const targets = [
            { angle: -50, radius: 54, action: () => handleToggleLike() },
            { angle: 0, radius: 62, action: () => handleShare() },
            { angle: 50, radius: 54, action: () => navigate(`/products/${product.id}`) },
          ];

          const hit = targets.find((target) => {
            const angleDiff = Math.abs(
              (((angleFromTop - target.angle + 180) % 360) - 180),
            );
            const radiusDiff = Math.abs(distance - target.radius);
            return angleDiff <= 20 && radiusDiff <= 18;
          });

          if (hit) {
            hit.action();
            return;
          }

          setIsMenuOpen((prev) => !prev);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (Date.now() - lastTouchRef.current < 450) {
            return;
          }
          setIsMenuOpen((prev) => !prev);
        }}
      >
        <img
          ref={imageRef}
          src={getFirstImage(product.image_urls)}
          alt={product.title}
          className="w-full h-full object-contain bg-gray-50"
          loading="lazy"
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
          }}
        />
        <div className={`radial-menu ${isMenuOpen ? "is-open" : ""}`}>
          <div className="radial-menu__items">
            <button
              type="button"
              className={`radial-menu__item radial-menu__item--like ${isLiked ? "is-active" : ""}`}
              style={{ "--angle": "-50deg", "--radius": "54px" }}
              onClick={handleToggleLike}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              <svg className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="radial-menu__item radial-menu__item--share"
              style={{ "--angle": "0deg", "--radius": "62px" }}
              onClick={handleShare}
              aria-label="Share"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M12 16V4m0 0l4 4m-4-4L8 8"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M4 12v5a2 2 0 002 2h12a2 2 0 002-2v-5"
                />
              </svg>
            </button>
            <button
              type="button"
              className="radial-menu__item radial-menu__item--details"
              style={{ "--angle": "50deg", "--radius": "54px" }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/products/${product.id}`);
              }}
              aria-label="View details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.title}
        </h3>

        <p
          className={`text-xl font-bold ${
            parseInt(product.price, 10) === 0
              ? "text-green-600"
              : "text-indigo-600"
          }`}
        >
          {formatPrice(product.price)}
        </p>
      </div>
    </div>
  );
}
