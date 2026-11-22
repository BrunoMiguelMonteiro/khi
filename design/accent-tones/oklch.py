import math
def s2l(c):
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def l2s(c):
    return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def hex2rgb(h):
    h=h.lstrip('#');return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def rgb2hex(rgb):
    return '#'+''.join('%02X'%max(0,min(255,round(v*255))) for v in rgb)
def lin2oklab(r,g,b):
    l=0.4122214708*r+0.5363325363*g+0.0514459929*b
    m=0.2119034982*r+0.6806995451*g+0.1073969566*b
    s=0.0883024619*r+0.2817188376*g+0.6299787005*b
    l,m,s=[math.copysign(abs(x)**(1/3),x) for x in (l,m,s)]
    return (0.2104542553*l+0.7936177850*m-0.0040720468*s,
            1.9779984951*l-2.4285922050*m+0.4505937099*s,
            0.0259040371*l+0.7827717662*m-0.8086757660*s)
def oklab2lin(L,a,b):
    l=L+0.3963377774*a+0.2158037573*b
    m=L-0.1055613458*a-0.0638541728*b
    s=L-0.0894841775*a-1.2914855480*b
    l,m,s=l**3,m**3,s**3
    return (4.0767416621*l-3.3077115913*m+0.2309699292*s,
            -1.2684380046*l+2.6097574011*m-0.3413193965*s,
            -0.0041960863*l-0.7034186147*m+1.7076147010*s)
def hex2oklab(h):
    return lin2oklab(*[s2l(c) for c in hex2rgb(h)])
def hex2oklch(h):
    L,a,b=hex2oklab(h);C=math.hypot(a,b);H=math.degrees(math.atan2(b,a))%360
    return L,C,H
def oklch2lin(L,C,H):
    return oklab2lin(L,C*math.cos(math.radians(H)),C*math.sin(math.radians(H)))
def in_gamut(L,C,H,eps=1e-6):
    return all(-eps<=v<=1+eps for v in oklch2lin(L,C,H))
def oklch2hex(L,C,H):
    L=max(0,min(1,L))
    if not in_gamut(L,C,H):
        lo,hi=0.0,C
        for _ in range(40):
            mid=(lo+hi)/2
            if in_gamut(L,mid,H): lo=mid
            else: hi=mid
        C=lo
    return rgb2hex([l2s(max(0,min(1,v))) for v in oklch2lin(L,C,H)])
def lum(h):
    r,g,b=[s2l(c) for c in hex2rgb(h)];return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    x,y=sorted([lum(a),lum(b)],reverse=True);return (x+0.05)/(y+0.05)
def deltaE(a,b):
    p,q=hex2oklab(a),hex2oklab(b);return math.dist(p,q)
