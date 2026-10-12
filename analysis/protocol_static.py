"""Focused offline ARM64 instruction evidence; not a full disassembler.

Only recognized instruction classes are decoded. Unknown words remain .word.
No target execution, networking, or external dependencies.
"""
import sys
import struct
from inspect_macho import MachO, APP

m = MachO(APP/'Frameworks/EdiabasKit.framework/EdiabasKit')
names = {a:n for n,a in m.exports.items()}
refs = {pc:(a,s) for pc,a,s in m.references()}
pos=32
stub_sections=[]
indirect=[]
for _ in range(struct.unpack_from('<I',m.data,16)[0]):
    cmd,size=struct.unpack_from('<II',m.data,pos)
    if cmd==0xb:
        off,count=struct.unpack_from('<II',m.data,pos+56)
        indirect=list(struct.unpack_from('<'+str(count)+'I',m.data,off))
    if cmd==0x19:
        for j in range(struct.unpack_from('<I',m.data,pos+64)[0]):
            q=pos+72+j*80
            if m.data[q:q+16].split(b'\0')[0]==b'__stubs':
                addr,length=struct.unpack_from('<QQ',m.data,q+32)
                index,stride=struct.unpack_from('<II',m.data,q+68)
                stub_sections.append((addr,length,index,stride))
    pos+=size
for addr,length,index,stride in stub_sections:
    for j in range(length//stride):
        ix=indirect[index+j]
        if ix<len(m.symbols):names[addr+j*stride]=m.symbols[ix][0]

def sx(v,b):
    return v-(1<<b) if v&(1<<(b-1)) else v

def reg(v,sf=True):
    return ('x' if sf else 'w')+str(v) if v!=31 else ('xzr' if sf else 'wzr')

def base(v):
    return reg(v) if v!=31 else 'sp'

def bitmask(i):
    width=64 if i>>31 else 32
    immr=i>>16&63; imms=i>>10&63; n=i>>22&1
    length=((n<<6)|((~imms)&63)).bit_length()-1
    if length<1:return '?'
    levels=(1<<length)-1;s=imms&levels;r=immr&levels;e=1<<length
    elem=(1<<(s+1))-1
    elem=((elem>>r)|(elem<<(e-r)))&((1<<e)-1)
    return hex(sum(elem<<j for j in range(0,width,e)))

def decode(pc,i):
    rd, rn, rm, sf = i&31, (i>>5)&31, (i>>16)&31, bool(i>>31)
    if i&0x7c000000==0x14000000:
        a=pc+(sx(i&0x3ffffff,26)<<2)
        return ('bl' if i>>31 else 'b')+f' {a:#x} '+names.get(a,'')
    if i&0xff000010==0x54000000:
        return f'b.cond{ i&15} {pc+(sx((i>>5)&0x7ffff,19)<<2):#x}'
    if i&0x7e000000==0x34000000:
        return ('cbnz' if i>>24&1 else 'cbz')+f' {reg(rd,sf)}, {pc+(sx((i>>5)&0x7ffff,19)<<2):#x}'
    if i&0x7e000000==0x36000000:
        return ('tbnz' if i>>24&1 else 'tbz')+f' {reg(rd,sf)}, #{((i>>31)<<5)|(i>>19&31)}, {pc+(sx((i>>5)&0x3fff,14)<<2):#x}'
    if i&0x9f000000 in (0x90000000,0x10000000):
        imm=sx(((i>>5&0x7ffff)<<2)|(i>>29&3),21)
        a=(pc&~4095)+(imm<<12) if i>>31 else pc+imm
        return f'adr{"p" if i>>31 else ""} x{rd}, {a:#x}'
    if i&0x1f800000==0x12800000:
        op={0:'movn',2:'movz',3:'movk'}.get(i>>29&3,'?')
        return f'{op} {reg(rd,sf)}, #{i>>5&65535:#x}, lsl #{(i>>21&3)*16}'
    if i&0x1f000000==0x11000000:
        op=('sub' if i>>30&1 else 'add')+('s' if i>>29&1 else '')
        dest=reg(rd,sf) if i>>29&1 else base(rd)
        return f'{op} {dest}, {base(rn)}, #{(i>>10&4095)<<(12 if i>>22&1 else 0):#x}'
    if i&0x1f800000==0x12000000:
        return ['and','orr','eor','ands'][i>>29&3]+f' {reg(rd,sf)}, {reg(rn,sf)}, #{bitmask(i)}'
    if i&0x1fe00c00==0x1a800000:
        return f'csel {reg(rd,sf)}, {reg(rn,sf)}, {reg(rm,sf)}, cond{i>>12&15}'
    if i&0x1f200000==0x0b000000:
        return ('sub' if i>>30&1 else 'add')+('s' if i>>29&1 else '')+f' {reg(rd,sf)}, {reg(rn,sf)}, {reg(rm,sf)}, shift{i>>22&3} #{i>>10&63}'
    if i&0x1f000000==0x0a000000:
        op=['and','orr','eor','ands'][i>>29&3]
        return f'{op} {reg(rd,sf)}, {reg(rn,sf)}, {reg(rm,sf)}, shift{ i>>22&3} #{i>>10&63}'
    if i&0x3b000000==0x39000000:
        if i>>26&1:
            return f'SIMD load/store (raw {i:#x})'
        size=i>>30&3; opc=i>>22&3
        op=('ldr' if opc else 'str')+({0:'b',1:'h'}.get(size,''))
        return f'{op} {reg(rd,size==3)}, [{base(rn)}, #{(i>>10&4095)<<size:#x}]'
    if i&0x3b200c00==0x38000000 and not i>>26&1:
        size=i>>30&3;opc=i>>22&3
        return ('ldur' if opc else 'stur')+f' {reg(rd,size==3)}, [{reg(rn)}, #{sx(i>>12&511,9)}]'
    if i&0x3b000000==0x18000000:
        a=pc+(sx(i>>5&0x7ffff,19)<<2)
        return f'ldr literal {reg(rd,sf)}, {a:#x}'
    if i&0x3a000000==0x28000000:
        if i>>26&1:return f'SIMD pair (raw {i:#x})'
        size=8 if i>>31 else 4
        return ('ldp' if i>>22&1 else 'stp')+f' {reg(rd,sf)}, {reg(i>>10&31,sf)}, [{base(rn)}, #{sx(i>>15&127,7)*size}] mode{i>>23&3}'
    if i&0xfffffc1f in (0xd61f0000,0xd63f0000,0xd65f0000):
        return {0xd61f0000:'br',0xd63f0000:'blr',0xd65f0000:'ret'}[i&0xfffffc1f]+f' x{rn}'
    return f'.word {i:#010x}'

if __name__=='__main__':
    start=int(sys.argv[1],0);end=int(sys.argv[2],0)
    for pc in range(start,end,4):
        i=struct.unpack_from('<I',m.data,m.offset(pc))[0]
        comment=''
        if pc in refs:
            a,s=refs[pc];comment=f' ; -> {a:#x} {s}'
        print(f'{pc:#010x}: {i:08x} {decode(pc,i)}{comment}')
