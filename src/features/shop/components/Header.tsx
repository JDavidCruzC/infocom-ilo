import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, User, Menu, X, ChevronDown, ChevronRight, MessageCircle, Sun, Moon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { COMPANY_NAME, WHATSAPP_NUMBER, COMPANY_PHONE } from "@/lib/types";
import { useCart } from "@/hooks/use-cart";
import { useTheme } from "@/features/theme/ThemeProvider";
import { useAuth } from "@/features/auth/hooks/useAuth";
import logoDark from "@/assets/logo-dark-theme.png";
import logoLight from "@/assets/logo-light-theme.png";
import CartDrawer from "@/features/cart/components/CartDrawer";
import { useCategories } from "@/features/shop/hooks/useCategories";
import { MOCK_CATEGORIES } from "@/lib/constants";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const { count } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user, roles, signOut } = useAuth();
  const { categories } = useCategories();
  const navigate = useNavigate();

  const logo = theme === "dark" ? logoDark : logoLight;
  const canAccessAdminPanel = roles.some(role => ["admin", "moderator", "user", "terminal"].includes(role));

  const cats = categories.length > 0 ? categories : MOCK_CATEGORIES.map(c => ({ ...c, children: c.subcategories })) as any[];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogo?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate("/catalogo");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full">
        {/* Top bar */}
        <div className="bg-primary text-primary-foreground text-xs py-1.5">
          <div className="container flex items-center justify-between">
            <span className="hidden sm:inline">📍 Ilo, Moquegua - Perú</span>
            <div className="flex items-center gap-4">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                <MessageCircle className="h-3 w-3" /> Contáctanos
              </a>
              <span className="hidden sm:inline">📞 {COMPANY_PHONE}</span>
              {user && canAccessAdminPanel && (
                <Link to="/admin" className="hover:underline font-bold">★ Panel</Link>
              )}
            </div>
          </div>
        </div>

        {/* Main header */}
        <div className="bg-card/95 backdrop-blur-xl border-b border-primary/20 shadow-lg shadow-primary/5">
          <div className="container flex items-center justify-between gap-4 py-3">
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <img src={logo} alt="INFOCOM" className="h-10 object-contain" />
            </Link>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl relative">
              <Input placeholder="Buscar productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 bg-secondary/50 border-primary/20 focus:border-primary/50" />
              <Button type="submit" size="icon" variant="ghost" className="absolute right-0 top-0 h-full text-primary">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:text-primary">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Link to={user ? "/cuenta" : "/login"}>
                <Button variant="ghost" size="icon" className="hover:text-primary">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              {user && (
                <Button variant="ghost" size="icon" className="hover:text-primary" onClick={handleSignOut} aria-label="Cerrar sesión">
                  <LogOut className="h-5 w-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="hover:text-primary relative" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground glow-green-sm">
                    {count}
                  </Badge>
                )}
              </Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation with Mega Menu */}
        <nav className="bg-card/90 backdrop-blur-md border-b border-primary/10 hidden md:block">
          <div className="container flex items-center gap-1 py-0">
            <Link to="/" className="px-4 py-3 text-sm font-medium hover:text-primary transition-colors">Inicio</Link>
            
            {/* Mega Menu Trigger */}
            <div 
              className="relative"
              onMouseEnter={() => setMegaMenuOpen(true)}
              onMouseLeave={() => { setMegaMenuOpen(false); setActiveCat(null); }}
            >
              <button className="flex items-center gap-1 px-4 py-3 text-sm font-medium hover:text-primary transition-colors">
                Catálogo <ChevronDown className={`h-3 w-3 transition-transform ${megaMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Mega Menu Dropdown */}
              {megaMenuOpen && (
                <div className="absolute top-full left-0 bg-card/95 backdrop-blur-md border border-primary/20 rounded-xl shadow-2xl shadow-primary/10 z-50 min-w-[700px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex">
                    {/* Categories sidebar */}
                    <div className="w-[240px] border-r border-primary/10 bg-secondary/30 py-2">
                      <Link 
                        to="/catalogo" 
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setMegaMenuOpen(false)}
                      >
                        🛒 Ver Todo el Catálogo
                      </Link>
                      <div className="h-px bg-primary/10 my-1" />
                      {cats.map((cat) => (
                        <div
                          key={cat.id}
                          className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-all ${
                            activeCat === cat.id 
                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                              : 'hover:bg-secondary/50 text-foreground'
                          }`}
                          onMouseEnter={() => setActiveCat(cat.id)}
                          onClick={() => { navigate(`/catalogo?cat=${cat.slug}`); setMegaMenuOpen(false); }}
                        >
                          <span>{cat.name}</span>
                          {cat.children?.length > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                        </div>
                      ))}
                    </div>

                    {/* Subcategories panel */}
                    <div className="flex-1 p-5 min-h-[300px]">
                      {activeCat ? (
                        (() => {
                          const cat = cats.find(c => c.id === activeCat);
                          if (!cat) return null;
                          return (
                            <div>
                              <h3 className="font-display font-bold text-lg text-primary mb-4 flex items-center gap-2">
                                {cat.name}
                              </h3>
                              {cat.children?.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {cat.children.map((sub: any) => (
                                    <Link
                                      key={sub.id}
                                      to={`/catalogo?cat=${sub.slug}`}
                                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-all group"
                                      onClick={() => setMegaMenuOpen(false)}
                                    >
                                      <div className="h-2 w-2 rounded-full bg-primary/30 group-hover:bg-primary transition-colors" />
                                      {sub.name}
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Explora todos los productos de {cat.name}
                                </p>
                              )}
                              <Link
                                to={`/catalogo?cat=${cat.slug}`}
                                className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-primary hover:underline"
                                onClick={() => setMegaMenuOpen(false)}
                              >
                                Ver todos los productos →
                              </Link>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          <div className="text-center">
                            <p className="text-lg mb-1">🖥️</p>
                            <p>Pasa el cursor sobre una categoría</p>
                            <p className="text-xs mt-1">para ver subcategorías</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link to="/contacto" className="px-4 py-3 text-sm font-medium hover:text-primary transition-colors">Contacto</Link>
            <Link to="/nosotros" className="px-4 py-3 text-sm font-medium hover:text-primary transition-colors">Sobre Nosotros</Link>
          </div>
        </nav>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-card/95 backdrop-blur-xl border-b border-primary/20 p-4 space-y-2 animate-in slide-in-from-top-2">
            <form onSubmit={handleSearch} className="relative mb-3">
              <Input placeholder="Buscar productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 bg-secondary/50 border-primary/20" />
              <Button type="submit" size="icon" variant="ghost" className="absolute right-0 top-0 h-full">
                <Search className="h-4 w-4 text-muted-foreground" />
              </Button>
            </form>
            <Link to="/" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setIsMenuOpen(false)}>Inicio</Link>
            <Link to="/catalogo" className="block py-2 text-sm font-bold text-primary" onClick={() => setIsMenuOpen(false)}>🛒 Ver Todo el Catálogo</Link>
            {cats.map((cat) => (
              <div key={cat.id}>
                <Link to={`/catalogo?cat=${cat.slug}`} className="block py-2 pl-4 text-sm font-medium hover:text-primary" onClick={() => setIsMenuOpen(false)}>
                  {cat.name}
                </Link>
                {cat.children?.map((sub: any) => (
                  <Link key={sub.id} to={`/catalogo?cat=${sub.slug}`} className="block py-1.5 pl-8 text-xs text-muted-foreground hover:text-primary" onClick={() => setIsMenuOpen(false)}>
                    {sub.name}
                  </Link>
                ))}
              </div>
            ))}
            <Link to="/contacto" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setIsMenuOpen(false)}>Contacto</Link>
            <Link to="/nosotros" className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setIsMenuOpen(false)}>Sobre Nosotros</Link>
          </div>
        )}
      </header>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
};

export default Header;
