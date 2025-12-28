const { useState, useEffect } = React;

/* --- DATABASE SIMULATION --- */
const db = {
    getUsers: () => JSON.parse(localStorage.getItem('wello_users') || "[]"),
    saveUser: (user) => {
        const users = db.getUsers();
        users.push(user);
        localStorage.setItem('wello_users', JSON.stringify(users));
    },
    findUser: (email, pass) => {
        const users = db.getUsers();
        return users.find(u => u.email === email && u.password === pass);
    },
    updateUserOrders: (email, order, couponCode) => {
        const users = db.getUsers();
        const index = users.findIndex(u => u.email === email);
        if(index !== -1) {
            if(!users[index].orders) users[index].orders = [];
            users[index].orders.push(order);
            
            if(couponCode) {
                if(!users[index].usedCoupons) users[index].usedCoupons = [];
                users[index].usedCoupons.push(couponCode);
            }
            localStorage.setItem('wello_users', JSON.stringify(users));
            return users[index];
        }
    },
    deleteUser: (email) => {
        let users = db.getUsers();
        users = users.filter(u => u.email !== email);
        localStorage.setItem('wello_users', JSON.stringify(users));
    }
};

/* --- COUPONS --- */
const COUPONS = { "WELCOME50": {type:"flat",value:50}, "CHEF200": {type:"flat",value:200}, "ZEROPRO99": {type:"special",value:998} };

/* --- PRODUCTS (UPDATED WITH YOUR FILES) --- */
const PRODUCTS = [
    { 
        id: 1, 
        name: "Electric Vegetable Cutter", 
        price: 999, 
        img: "./Veg_cut_1.webp", 
        desc: "Slice, mince, chop, and peel in seconds. Handheld electric cutter." 
    },
    { 
        id: 2, 
        name: "Silicone Oil Brush", 
        price: 499, 
        img: "./Slicon_br_1.webp", 
        desc: "Cook healthier with less oil. Heat resistant brush." 
    },
    { 
        id: 3, 
        name: "Portable Blender", 
        price: 1299, 
        img: "./fruit_js_1.avif", 
        desc: "Fresh smoothies on the go. Powerful 6-blade motor." 
    },
    { 
        id: 4, 
        name: "Digital Kitchen Scale", 
        price: 799, 
        img: "./weight_1.jpg", 
        desc: "Chef-level precision. Measure with 0.1g accuracy." 
    }
];

const Footer = () => ( <footer><h2>WELLO.</h2><div className="footer-links"><span>Shop</span><span>About</span><span>Support</span></div><p>&copy; 2025 WELLO Kitchenware.</p></footer> );

/* --- MAIN APP --- */
const App = () => {
    const [view, setView] = useState('login'); 
    const [user, setUser] = useState(null);
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // Checkout States
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [qty, setQty] = useState(1);
    const [checkoutItems, setCheckoutItems] = useState([]); 
    const [form, setForm] = useState({ address: '', phone: '' });
    const [paymentDetails, setPaymentDetails] = useState(null);

    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponMsg, setCouponMsg] = useState("");
    const [utr, setUtr] = useState("");

    const [authData, setAuthData] = useState({ name: '', email: '', password: '' });

    useEffect(() => {
        const savedUser = JSON.parse(localStorage.getItem('wello_current_user'));
        if (savedUser) { setUser(savedUser); setView('home'); }
    }, []);

    // --- LOGIC ---
    const calculateTotal = (items) => {
        let subtotal = items.reduce((sum, item) => sum + item.price, 0);
        let discount = 0;
        if (appliedCoupon) {
            const rule = COUPONS[appliedCoupon];
            if (rule.type === "flat") discount = rule.value;
            else if (rule.type === "percent") discount = Math.round(subtotal * (rule.value / 100));
            else if (rule.type === "special") items.forEach(item => { discount += Math.min(item.price, rule.value); });
        }
        return { subtotal, discount, finalTotal: Math.max(0, subtotal - discount) };
    };

    const handleSignup = () => {
        if(!authData.name || !authData.email || !authData.password) return alert("Fill all fields");
        if(db.getUsers().find(u => u.email === authData.email)) return alert("Email exists");
        db.saveUser({ ...authData, orders: [], usedCoupons: [] });
        alert("Account Created!"); setView('login');
    };

    const handleLogin = () => {
        const found = db.findUser(authData.email, authData.password);
        if(found) { setUser(found); localStorage.setItem('wello_current_user', JSON.stringify(found)); setView('home'); }
        else alert("Invalid Credentials");
    };

    const handleLogout = () => { localStorage.removeItem('wello_current_user'); setUser(null); setView('login'); setCart([]); };

    const handleDeleteProfile = () => {
        if(confirm("Are you sure? This will delete your account and order history permanently.")) {
            db.deleteUser(user.email);
            handleLogout();
            alert("Profile Deleted.");
        }
    };

    const addToCart = (product, quantity) => { setCart([...cart, ...Array(quantity).fill(product)]); setIsCartOpen(true); };
    const removeFromCart = (i) => { const n = [...cart]; n.splice(i, 1); setCart(n); };

    const applyCoupon = () => {
        const code = couponInput.trim().toUpperCase();
        if (!COUPONS[code]) { setCouponMsg("Invalid Code"); setAppliedCoupon(null); return; }
        if (user.usedCoupons && user.usedCoupons.includes(code)) { setCouponMsg("Already used!"); setAppliedCoupon(null); return; }
        setAppliedCoupon(code); setCouponMsg("Applied!");
    };

    const startCheckout = (items) => {
        setCheckoutItems(items); setAppliedCoupon(null); setCouponInput(""); setCouponMsg("");
        setIsCartOpen(false); setView('checkout'); window.scrollTo(0,0);
    };

    const goToPayment = (e) => {
        e.preventDefault();
        const { finalTotal } = calculateTotal(checkoutItems);
        const orderId = "#ORD-" + Math.floor(Math.random() * 999999);
        const itemNames = checkoutItems.map(i => i.name).join(", ");
        
        setPaymentDetails({ finalTotal, orderId, itemNames });
        setUtr(""); 
        setView('payment');
        window.scrollTo(0,0);
    };

    // --- FINAL STEP: VERIFY, EMAIL & WHATSAPP ---
    const submitVerification = async (e) => {
        e.preventDefault();
        if(utr.length < 4) { alert("Please enter valid UTR."); return; }

        const { finalTotal, orderId, itemNames } = paymentDetails;

        // 1. Google Sheets
        const GOOGLE_SCRIPT_URL = "PASTE_YOUR_GOOGLE_SCRIPT_URL_HERE"; 
        if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes("PASTE")) {
            try { await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST", mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_id: orderId, name: user.name, email: user.email, items: itemNames, amount: finalTotal, utr: utr })
            }); } catch (e) {}
        }

        // 2. Email (Formspree)
        try { await fetch("https://formspree.io/f/mqekbvke", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, message: `New Order: ${orderId}. UTR: ${utr}. Total: ₹${finalTotal}` })
        }); } catch(e) {}

        // 3. Update DB
        const updatedUser = db.updateUserOrders(user.email, { id: orderId, date: new Date().toLocaleDateString(), items: itemNames, total: finalTotal, status: "Verification Pending", utr: utr }, appliedCoupon);
        setUser(updatedUser);
        localStorage.setItem('wello_current_user', JSON.stringify(updatedUser));

        // 4. WHATSAPP NOTIFICATION
        // Updated to your Kotak ID number logic for message clarity
        const waMessage = `Hello WELLO Team, I have placed an order.\n\nOrder ID: ${orderId}\nAmount: ₹${finalTotal}\nUTR/Ref No: ${utr}\n\nPlease confirm my order.`;
        const waLink = `https://wa.me/919354163161?text=${encodeURIComponent(waMessage)}`;
        
        window.open(waLink, '_blank'); 

        alert("Order Placed! Please send the WhatsApp message to confirm.");
        setCart([]); setCheckoutItems([]); setView('profile');
    };

    const currentTotals = calculateTotal(view === 'checkout' ? checkoutItems : cart);

    // --- VIEWS ---
    if(view === 'login' || view === 'signup') return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>WELLO.</h2>
                {view === 'login' ? (
                    <>
                        <input type="email" placeholder="Email" onChange={e => setAuthData({...authData, email: e.target.value})} />
                        <input type="password" placeholder="Password" onChange={e => setAuthData({...authData, password: e.target.value})} />
                        <button onClick={handleLogin}>LOG IN</button>
                        <p className="switch-text" onClick={() => setView('signup')}>New? <span>Sign Up</span></p>
                    </>
                ) : (
                    <>
                        <input type="text" placeholder="Name" onChange={e => setAuthData({...authData, name: e.target.value})} />
                        <input type="email" placeholder="Email" onChange={e => setAuthData({...authData, email: e.target.value})} />
                        <input type="password" placeholder="Password" onChange={e => setAuthData({...authData, password: e.target.value})} />
                        <button onClick={handleSignup}>CREATE ACCOUNT</button>
                        <p className="switch-text" onClick={() => setView('login')}>Member? <span>Log In</span></p>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div>
            <nav>
                <div className="logo" onClick={() => setView('home')}>WELLO.</div>
                <div className="nav-icons">
                    <span onClick={() => setView('profile')} className="icon-btn"><i className="fas fa-user"></i></span>
                    <span onClick={() => setIsCartOpen(true)} className="icon-btn">
                        <i className="fas fa-shopping-bag"></i>
                        {cart.length > 0 && <div className="badge">{cart.length}</div>}
                    </span>
                    <span onClick={handleLogout} className="icon-btn" style={{color:'#e74c3c'}}><i className="fas fa-sign-out-alt"></i></span>
                </div>
            </nav>

            {/* PAYMENT PAGE (UTR + STATIC QR) */}
            {view === 'payment' && paymentDetails && (
                <div className="container" style={{paddingTop: 60}}>
                    <div className="payment-page">
                        <div className="payment-header">
                            <h2>Complete Payment</h2>
                            <p style={{color:'red', fontWeight:'bold'}}>Scan & Enter Transaction ID</p>
                        </div>
                        
                        {/* STATIC QR IMAGE */}
                        <div className="qr-frame">
                            <img src="./payment_qr.jpeg" alt="Scan to Pay" />
                        </div>
                        
                        {/* UPDATED UPI ID FROM YOUR IMAGE */}
                        <div className="upi-id-box">9354163161@kotak811</div>
                        <div style={{marginBottom: 20, fontSize: '1.2rem', fontWeight: 'bold'}}>Amount: ₹{paymentDetails.finalTotal}</div>

                        <form onSubmit={submitVerification} style={{textAlign:'left', marginTop:20}}>
                            <label style={{display:'block', marginBottom:8, fontWeight:600}}>Enter Transaction ID / UTR:</label>
                            <input type="text" required placeholder="Example: 3452 8921 0021" value={utr} onChange={e => setUtr(e.target.value)} style={{width:'100%', padding:12, border:'2px solid var(--primary)', borderRadius:8, marginBottom:15}} />
                            <button className="confirm-pay-btn">VERIFY & PLACE ORDER <i className="fab fa-whatsapp"></i></button>
                        </form>
                        <button className="delete-btn" style={{background:'transparent', color:'#666', border:'none', marginTop:10}} onClick={() => setView('checkout')}>Cancel</button>
                    </div>
                </div>
            )}

            {/* CHECKOUT PAGE */}
            {view === 'checkout' && (
                <div className="container" style={{paddingTop: 40}}>
                    <div className="back-btn" onClick={() => setView('home')}><i className="fas fa-arrow-left"></i> Cancel</div>
                    <div className="checkout-container">
                        <h2 className="checkout-header">Secure Checkout</h2>
                        <div className="checkout-summary">
                            <h3>Order Summary</h3>
                            {checkoutItems.map((item, i) => <div key={i} className="summary-item"><span>{item.name}</span><span>₹{item.price}</span></div>)}
                            <div className="coupon-section">
                                <div className="coupon-row">
                                    <input type="text" className="coupon-input" placeholder="Enter Coupon Code" value={couponInput} onChange={e => setCouponInput(e.target.value)} />
                                    <button className="apply-btn" onClick={applyCoupon}>APPLY</button>
                                </div>
                                <div className={`coupon-msg ${appliedCoupon ? 'success' : 'error'}`}>{couponMsg}</div>
                            </div>
                            <div className="summary-total" style={{display:'block'}}>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'1rem', marginBottom:5, color:'#666'}}>
                                    <span>Subtotal:</span><span>₹{currentTotals.subtotal}</span>
                                </div>
                                {appliedCoupon && (
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'1rem', marginBottom:5, color:'green'}}>
                                        <span>Discount ({appliedCoupon}):</span><span>- ₹{currentTotals.discount}</span>
                                    </div>
                                )}
                                <div style={{display:'flex', justifyContent:'space-between', marginTop:10, borderTop:'1px solid #ddd', paddingTop:10}}>
                                    <span>Total to Pay:</span><span>₹{currentTotals.finalTotal}</span>
                                </div>
                            </div>
                        </div>
                        <form onSubmit={goToPayment}>
                            <div className="form-group"><label>Delivery Address</label><input type="text" required placeholder="Full Address" onChange={e => setForm({...form, address: e.target.value})} /></div>
                            <div className="form-group"><label>Phone Number</label><input type="tel" required placeholder="Mobile Number" onChange={e => setForm({...form, phone: e.target.value})} /></div>
                            <button className="buy-now-btn">PROCEED TO PAY</button>
                        </form>
                    </div>
                </div>
            )}

            {/* PRODUCT PAGE */}
            {view === 'product' && selectedProduct && (
                <div className="container p-view">
                    <div className="back-btn" onClick={() => setView('home')}><i className="fas fa-arrow-left"></i> Back to Shop</div>
                    <div className="p-layout">
                        <div className="p-image"><img src={selectedProduct.img} alt={selectedProduct.name} /></div>
                        <div className="p-info">
                            <h1>{selectedProduct.name}</h1>
                            <span className="price-tag">₹{selectedProduct.price}</span>
                            <p className="desc">{selectedProduct.desc}</p>
                            <div className="p-actions">
                                <div className="qty-row">
                                    <span>Quantity:</span><button className="qty-btn" onClick={() => setQty(Math.max(1, qty-1))}>-</button>
                                    <span className="qty-val">{qty}</span><button className="qty-btn" onClick={() => setQty(qty+1)}>+</button>
                                </div>
                                <button className="add-btn-large" onClick={() => addToCart(selectedProduct, qty)}>ADD TO CART</button>
                                <button className="buy-now-btn" onClick={() => startCheckout(Array(qty).fill(selectedProduct))}>BUY NOW</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'home' && (
                <div>
                    <header className="hero"><h1>The Chef's Collection</h1><p>Elevate your cooking with our premium selection.</p></header>
                    <div className="container"><div className="grid">{PRODUCTS.map(prod => (
                        <div key={prod.id} className="product-card" onClick={() => { setSelectedProduct(prod); setQty(1); setView('product'); window.scrollTo(0,0); }}>
                            <img src={prod.img} alt={prod.name} /><div className="p-details"><h3>{prod.name}</h3><div className="price-row"><span className="price">₹{prod.price}</span></div></div>
                        </div>
                    ))}</div></div>
                </div>
            )}

            {/* PROFILE */}
            {view === 'profile' && (
                <div className="container" style={{marginTop:40}}>
                    <div className="profile-header"><div className="avatar">{user.name.charAt(0)}</div><h2>{user.name}</h2><p>{user.email}</p><button className="delete-btn" onClick={handleDeleteProfile}>DELETE PROFILE</button></div>
                    <div className="order-history"><h3>Your Orders</h3>{user.orders && user.orders.length > 0 ? user.orders.map((order, i) => (
                        <div key={i} className="order-item">
                            <div><strong>{order.items}</strong><br/><small>{order.date} • {order.id}</small>
                            <div style={{fontSize:'0.8rem', color:'#666', marginTop:5}}>UTR: {order.utr || "N/A"}</div>
                            </div>
                            <div className="status">{order.status || "Paid"} <br/> ₹{order.total}</div>
                        </div>
                    )) : <p style={{color:'#888'}}>No orders yet.</p>}</div>
                </div>
            )}

            <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
            <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`}>
                <div className="cart-header"><h2>Bag ({cart.length})</h2><i className="fas fa-times" onClick={() => setIsCartOpen(false)} style={{cursor:'pointer'}}></i></div>
                <div className="cart-items">{cart.map((item, i) => (<div key={i} className="cart-item"><span>{item.name}</span><b>₹{item.price}</b><i className="fas fa-trash" onClick={() => removeFromCart(i)} style={{color:'red',cursor:'pointer'}}></i></div>))}</div>
                <div style={{paddingTop:20, borderTop:'1px solid #eee'}}><button className="checkout-btn" onClick={() => startCheckout(cart)}>PROCEED TO CHECKOUT</button></div>
            </div>

            {(view === 'home' || view === 'product') && <Footer />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);